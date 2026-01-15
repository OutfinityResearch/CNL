import fs from "node:fs";
import path from "node:path";
import { parseProgram, parseProgramIncremental } from "../parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../runtime/engine.mjs";
import { loadDefaultBaseBundle } from "../theories/loader.mjs";
import {
  analyzeCrossOntologyDuplicates,
  expandTheoryEntrypoint,
  expandTheoryText,
  extractLoadTimeRenames,
  hasPreprocessorDirectives,
  mergeIssuesIntoDictionaryWarnings,
} from "../theories/diagnostics.mjs";
import { applyLoadTimeRenames } from "../theories/renames.mjs";

function createError(code, message) {
  return {
    code,
    name: "SessionError",
    message,
    severity: "error",
    primaryToken: "EOF",
    hint: "Adjust session options or input content.",
  };
}

export class CNLSession {
  constructor(options = {}) {
    this.options = {
      projectEntityAttributes: false,
      validateDictionary: true,
      autoloadBase: true,
      baseEntrypoint: null,
      rootDir: process.cwd(),
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
            errors: [createError("SES022", extracted.issues[0].message)],
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
          errors: [createError("SES021", `Failed to expand Load directives: ${error.message || error}`)],
          applied: false,
        };
      }
    }

    if (transactional && incremental) {
      return { errors: [createError("SES001", "Transactional and incremental are exclusive.")] };
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
        parseErrors.push(...(parsed.errors.length ? parsed.errors : [createError("SES009", "Parser error.")]));
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
      return { error: createError("SES019", "Cannot mix commands and statements in execute().") };
    }

    // If there are no commands or statements.
    return { error: createError("SES020", "No valid commands or statements found.") };
  }

  query(cnlText, options = {}) {
    const { command, error } = this.#parseCommand(cnlText);
    if (error) return { error };
    if (command.kind !== "ReturnCommand" && command.kind !== "FindCommand") {
      return { error: createError("SES010", "Query requires a return or find command.") };
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
      return { error: createError("SES011", "Proof requires a verify command.") };
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
      return { error: createError("SES012", "Explain requires an explain command.") };
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
      return { error: createError("SES013", "Plan requires a plan command.") };
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
      return { error: createError("SES014", "Simulate requires a simulate command.") };
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
      return { error: createError("SES015", "Optimize requires a maximize or minimize command.") };
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
      return { error: createError("SES018", "Solve requires a solve command.") };
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
    return createError("SES009", error?.message ?? "Parser error.");
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
      return { command: null, error: createError("SES016", "No command found in input.") };
    }
    if (ast.items.length !== commandItems.length) {
      return { command: null, error: createError("SES017", "Command input must not include statements.") };
    }
    return { command: commandItems[0].command, error: null };
  }
}
