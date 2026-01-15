import fs from "node:fs";
import path from "node:path";
import { parseProgram, parseProgramIncremental } from "../parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../compiler/compile.mjs";
import { executeCommandAst, executeProgram, materializeRules } from "../runtime/engine.mjs";
import { loadDefaultBaseBundle } from "../theories/loader.mjs";
import {
  analyzeCrossOntologyDuplicates,
  analyzeContradictoryAssertions,
  expandTheoryEntrypoint,
  expandTheoryText,
  extractLoadTimeRenames,
  hasPreprocessorDirectives,
  mergeIssuesIntoDictionaryWarnings,
} from "../theories/diagnostics.mjs";
import { applyLoadTimeRenames } from "../theories/renames.mjs";
import { createError } from "../validator/errors.mjs";

function sessionError(code, message, primaryToken = "EOF", overrides = {}) {
  return createError(code, primaryToken, {
    name: "SessionError",
    message,
    hint: overrides.hint ?? "Adjust session options or input content.",
    offendingField: overrides.offendingField,
  });
}

export class CNLSession {
  /**
   * Creates a new in-memory CNL session (per-tab, per-run instance).
   *
   * The session owns a compiler/runtime state and can (re)load theory bundles
   * transactionally or incrementally.
   *
   * @param {object} [options]
   * @param {boolean} [options.autoloadBase=true] Whether to automatically load the base bundle.
   * @param {string|null} [options.baseEntrypoint=null] Bundle entrypoint (relative to `rootDir`).
   * @param {string} [options.rootDir=process.cwd()] Root used to resolve `Load:` directives.
   * @param {boolean} [options.projectEntityAttributes=false] Whether to project entity attributes into binary facts.
   */
  constructor(options = {}) {
    this.options = {
      projectEntityAttributes: false,
      validateDictionary: true,
      autoloadBase: true,
      baseEntrypoint: null,
      rootDir: process.cwd(),
      limits: {
        plan: {
          maxDepth: 6,
          maxNodes: 200,
        },
        solve: {
          maxPropagationIterationsFactor: 6,
          minPropagationIterations: 12,
          maxSolutions: 25,
          maxTraceSteps: 250,
          maxSolutionSummary: 5,
          maxPremiseSolutions: 10,
        },
      },
      ...options,
    };
    this.state = createCompilerState(this.options);
    this.sources = [];

    if (this.options.autoloadBase) {
      this.#autoloadBase();
    }
  }

  learn(theoryFile, options = {}) {
    const text = fs.readFileSync(theoryFile, "utf8");
    return this.learnText(text, { ...options, source: theoryFile });
  }

  learnText(cnlText, options = {}) {
    const transactional = options.transactional ?? true;
    const incremental = options.incremental ?? false;
    const source = options.source || null;
    const rootDir = this.options.rootDir ?? process.cwd();
    let loadTimeRenames = null;
    let expandedFiles = null;
    let preIssues = [];
    let expandedTexts = [cnlText];

    if (hasPreprocessorDirectives(cnlText)) {
      try {
        const expanded = expandTheoryText(cnlText, { rootDir, source });
        expandedFiles = expanded.files;
        expandedTexts = expanded.segments.map((s) => s.text);
        const extracted = extractLoadTimeRenames(expandedFiles);
        if (extracted.issues.some((i) => i.severity === "error")) {
          return {
            errors: [sessionError("SES022", extracted.issues[0].message)],
            applied: false,
          };
        }
        preIssues = extracted.issues;
        loadTimeRenames = {
          predicateKeyRenames: extracted.predicateKeyRenames,
          typeKeyRenames: extracted.typeKeyRenames,
        };
      } catch (error) {
        return {
          errors: [sessionError("SES021", `Failed to expand Load directives: ${error.message || error}`)],
          applied: false,
        };
      }
    }

    if (transactional && incremental) {
      return { errors: [sessionError("SES001", "Transactional and incremental are exclusive.")] };
    }

    if (transactional) {
      const texts = [...this.sources, ...expandedTexts];
      const state = this.#compileSources(texts, { loadTimeRenames, expandedFiles });
      mergeIssuesIntoDictionaryWarnings(state.dictionary, preIssues, { issueKeyPrefix: "rename-directive" });
      if (state.errors.length > 0) {
        return { errors: state.errors, applied: false };
      }
      this.state = state;
      this.sources = texts;
      return { errors: [], applied: true };
    }

    this.state.errors.length = 0;
    const parsedPrograms = [];
    const parseErrors = [];

    for (const text of expandedTexts) {
      const parsed = parseProgramIncremental(text);
      if (!parsed.program) {
        parseErrors.push(...(parsed.errors.length ? parsed.errors : [sessionError("SES009", "Parser error.")]));
        break;
      }
      if (parsed.errors.length) {
        parseErrors.push(...parsed.errors);
      }
      if (loadTimeRenames) {
        const renamed = applyLoadTimeRenames(parsed.program, loadTimeRenames);
        mergeIssuesIntoDictionaryWarnings(this.state.dictionary, renamed.appliedIssues, { issueKeyPrefix: "rename" });
      }
      parsedPrograms.push(parsed.program);
    }

    if (parseErrors.length) {
      // Continue compilation for any successfully parsed programs, but report errors.
    }

    for (const program of parsedPrograms) {
      compileProgram(program, {
        state: this.state,
        projectEntityAttributes: this.options.projectEntityAttributes,
      });
      if (this.state.errors.length > 0) break;
    }

    mergeIssuesIntoDictionaryWarnings(this.state.dictionary, preIssues, { issueKeyPrefix: "rename-directive" });
    if (expandedFiles) {
      const dupIssues = analyzeCrossOntologyDuplicates(expandedFiles, { includeBenign: true, renames: loadTimeRenames });
      mergeIssuesIntoDictionaryWarnings(this.state.dictionary, dupIssues, { issueKeyPrefix: "theory" });
    }

    if (parseErrors.length) {
      const merged = [...parseErrors, ...this.state.errors];
      this.state.errors.length = 0;
      this.state.errors.push(...merged);
    }

    if (this.state.errors.length === 0) {
      this.sources.push(...expandedTexts);
    }
    return { errors: this.state.errors, applied: this.state.errors.length === 0 };
  }

  execute(cnlText, options = {}) {
    if (hasPreprocessorDirectives(cnlText)) {
      return this.learnText(cnlText, options);
    }
    // Automatic routing: detect whether this is a command or a statement batch.
    let ast = null;
    try {
      ast = parseProgram(cnlText);
    } catch (error) {
      return { error: this.#toErrorObject(error) };
    }

    const commandItems = ast.items.filter((item) => item.kind === "CommandStatement");
    const statementItems = ast.items.filter((item) => 
      item.kind === "Statement" || 
      item.kind === "RuleStatement" || 
      item.kind === "TransitionRuleStatement" ||
      item.kind === "ActionBlock"
    );

    // If there are only commands, execute the first command.
    if (commandItems.length > 0 && statementItems.length === 0) {
      const command = commandItems[0].command;
      
      // Materialize rules if needed.
      if (options.deduce ?? true) {
        materializeRules(this.state, { justificationStore: this.state.justificationStore });
      }
      
      return executeCommandAst(command, this.state);
    }

    // If there are statements, learn them.
    if (statementItems.length > 0 && commandItems.length === 0) {
      return this.learnText(cnlText, options);
    }

    // If mixed, return an error.
    if (commandItems.length > 0 && statementItems.length > 0) {
      return { error: sessionError("SES019", "Cannot mix commands and statements in execute().") };
    }

    // If there are no commands or statements.
    return { error: sessionError("SES020", "No valid commands or statements found.") };
  }

  runProgram(cnlText, options = {}) {
    if (hasPreprocessorDirectives(cnlText)) {
      return { error: sessionError("SES023", "Program execution does not support Load/Rename directives yet.") };
    }

    let ast = null;
    try {
      ast = parseProgram(cnlText);
    } catch (error) {
      return { error: this.#toErrorObject(error) };
    }

    const transactional = options.transactional ?? true;
    if (!transactional) {
      const out = executeProgram(ast, this.state, {
        deduce: options.deduce ?? true,
        projectEntityAttributes: this.options.projectEntityAttributes,
      });
      if (out?.kind === "ProgramResult" && out.errors?.length === 0) {
        this.sources.push(cnlText);
      }
      return out;
    }

    // Transactional: rebuild from prior sources, then apply the program sequentially.
    const baseState = this.#compileSources([...this.sources], { loadTimeRenames: null, expandedFiles: null });
    if (baseState.errors.length > 0) {
      return { errors: baseState.errors, applied: false };
    }

    const out = executeProgram(ast, baseState, {
      deduce: options.deduce ?? true,
      projectEntityAttributes: this.options.projectEntityAttributes,
    });

    if (!out || out.kind !== "ProgramResult" || (out.errors && out.errors.length > 0)) {
      return { errors: out?.errors || [sessionError("SES024", "Program execution failed.")], applied: false };
    }

    this.state = baseState;
    this.sources.push(cnlText);
    return { ...out, applied: true, errors: [] };
  }

  query(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "ReturnCommand" && command.kind !== "FindCommand") {
      return { error: sessionError("SES010", "Query requires a return or find command.") };
    }
    if (options.deduce ?? false) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  proof(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "VerifyCommand") {
      return { error: sessionError("SES011", "Proof requires a verify command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  explain(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "ExplainCommand") {
      return { error: sessionError("SES012", "Explain requires an explain command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  plan(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "PlanCommand") {
      return { error: sessionError("SES013", "Plan requires a plan command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  simulate(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "SimulateCommand") {
      return { error: sessionError("SES014", "Simulate requires a simulate command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  optimize(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "MaximizeCommand" && command.kind !== "MinimizeCommand") {
      return { error: sessionError("SES015", "Optimize requires a maximize or minimize command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  solve(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "SolveCommand") {
      return { error: sessionError("SES018", "Solve requires a solve command.") };
    }
    if (options.deduce ?? true) {
      materializeRules(this.state, { justificationStore: this.state.justificationStore });
    }
    return executeCommandAst(command, this.state);
  }

  snapshot() {
    return { sources: [...this.sources] };
  }

  reset() {
    this.state = createCompilerState(this.options);
    this.sources = [];
    if (this.options.autoloadBase) {
      this.#autoloadBase();
    }
  }

  #autoloadBase() {
    const rootDir = this.options.rootDir ?? process.cwd();
    const baseEntrypoint = this.options.baseEntrypoint ?? null;
    const entryAbs = baseEntrypoint
      ? path.resolve(rootDir, baseEntrypoint)
      : loadDefaultBaseBundle({ rootDir }).dictionary[0].path;

    const entryRel = path.relative(rootDir, entryAbs).replace(/\\/g, "/");
    const expanded = expandTheoryEntrypoint(entryRel, { rootDir });
    const extracted = extractLoadTimeRenames(expanded.files);
    if (extracted.issues.some((i) => i.severity === "error")) {
      throw new Error(`CNLSession autoloadBase failed: ${extracted.issues[0].message}`);
    }
    const loadTimeRenames = {
      predicateKeyRenames: extracted.predicateKeyRenames,
      typeKeyRenames: extracted.typeKeyRenames,
    };

    const texts = expanded.segments.map((s) => s.text);
    const state = this.#compileSources(texts, { loadTimeRenames, expandedFiles: expanded.files });
    mergeIssuesIntoDictionaryWarnings(state.dictionary, extracted.issues, { issueKeyPrefix: "rename-directive" });
    if (state.errors.length > 0) {
      const first = state.errors[0];
      const message = first?.message ?? "Failed to load base theory.";
      throw new Error(`CNLSession autoloadBase failed: ${message}`);
    }

    this.state = state;
    this.sources = texts;
  }

  #compileSources(texts, options = {}) {
    const state = createCompilerState(this.options);
    const loadTimeRenames = options.loadTimeRenames ?? null;
    for (const text of texts) {
      state.errors.length = 0;
      const ast = this.#parseSafe(text, state);
      if (!ast) {
        break;
      }
      if (loadTimeRenames) {
        const renamed = applyLoadTimeRenames(ast, loadTimeRenames);
        mergeIssuesIntoDictionaryWarnings(state.dictionary, renamed.appliedIssues, { issueKeyPrefix: "rename" });
      }
      compileProgram(ast, {
        state,
        projectEntityAttributes: this.options.projectEntityAttributes,
      });
      if (state.errors.length > 0) {
        break;
      }

      // Enforce explicit contradiction rejection (N1 in todo_next.md / DS24).
      const contradictions = analyzeContradictoryAssertions(state);
      if (contradictions.length > 0) {
        contradictions.forEach((c) => state.dictionary.errors.push(c));
        const first = contradictions[0];
        state.errors.push({
          code: "CMP020",
          name: "CompilerError",
          message: first.message,
          severity: "error",
          primaryToken: first.key ?? "EOF",
          hint: first.hint ?? "Remove contradictory explicit assertions.",
        });
        break;
      }
    }

    const expandedFiles = options.expandedFiles ?? null;
    if (expandedFiles) {
      const dupIssues = analyzeCrossOntologyDuplicates(expandedFiles, { includeBenign: true, renames: loadTimeRenames });
      mergeIssuesIntoDictionaryWarnings(state.dictionary, dupIssues, { issueKeyPrefix: "theory" });
    }
    return state;
  }

  #parseSafe(text, state = this.state) {
    try {
      return parseProgram(text);
    } catch (error) {
      state.errors.push(this.#toErrorObject(error));
      return null;
    }
  }

  #toErrorObject(error) {
    if (error && typeof error === "object" && error.code) {
      return error;
    }
    return sessionError("SES009", error?.message ?? "Parser error.");
  }

  #parseCommand(cnlText) {
    let ast = null;
    try {
      ast = parseProgram(cnlText);
    } catch (error) {
      return { command: null, error: this.#toErrorObject(error) };
    }
    const commandItems = ast.items.filter((item) => item.kind === "CommandStatement");
    if (commandItems.length === 0) {
      return { command: null, error: sessionError("SES016", "No command found in input.") };
    }
    if (ast.items.length !== commandItems.length) {
      return { command: null, error: sessionError("SES017", "Command input must not include statements.") };
    }
    return { command: commandItems[0].command, error: null };
  }
}
