import fs from "node:fs";
import path from "node:path";
import { parseProgram, parseProgramIncremental } from "../parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../runtime/engine.mjs";
import { loadDefaultBaseBundle } from "../theories/loader.mjs";
import { analyzeCrossOntologyDuplicates, expandTheoryEntrypoint, mergeIssuesIntoDictionaryWarnings } from "../theories/diagnostics.mjs";

const LOAD_DIRECTIVE_RE = /^\s*Load\s*:\s*"([^"]+)"\s*\.\s*$/i;

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

function isWithinRoot(rootDir, absPath) {
  const rel = path.relative(rootDir, absPath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveLoadPath(raw, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const baseDir = source ? path.dirname(source) : rootDir;
  const cleaned = String(raw || "").trim();
  if (!cleaned) {
    throw new Error("Empty load path.");
  }

  const abs = path.isAbsolute(cleaned)
    ? cleaned
    : cleaned.startsWith("./") || cleaned.startsWith("../")
      ? path.resolve(baseDir, cleaned)
      : path.resolve(rootDir, cleaned);

  const rootAbs = path.resolve(rootDir);
  const absNorm = path.resolve(abs);
  if (!isWithinRoot(rootAbs, absNorm)) {
    throw new Error(`Load path escapes rootDir: ${cleaned}`);
  }
  return absNorm;
}

function inlineLoadDirectives(text, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const visited = options.visited ?? new Set();

  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  let out = "";
  for (const line of lines) {
    const match = line.match(LOAD_DIRECTIVE_RE);
    if (!match) {
      out += line + "\n";
      continue;
    }
    const abs = resolveLoadPath(match[1], { rootDir, source });
    if (visited.has(abs)) {
      throw new Error(`Cyclic Load detected: ${abs}`);
    }
    visited.add(abs);
    const loaded = fs.readFileSync(abs, "utf8");
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    out += `// --- LOAD: ${rel} ---\n`;
    out += inlineLoadDirectives(loaded, { rootDir, source: abs, visited });
    out += `// --- END LOAD: ${rel} ---\n`;
  }
  return out;
}

function hasLoadDirectives(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  return lines.some((line) => LOAD_DIRECTIVE_RE.test(line));
}

export class CNLSession {
  constructor(options = {}) {
    this.options = {
      projectEntityAttributes: false,
      validateDictionary: true,
      reportBenignTheoryDuplicates: false,
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
    let expandedText = cnlText;

    if (hasLoadDirectives(cnlText)) {
      try {
        expandedText = inlineLoadDirectives(cnlText, { rootDir: this.options.rootDir, source, visited: new Set() });
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
      const texts = [...this.sources, expandedText];
      const state = this.#compileSources(texts);
      if (state.errors.length > 0) {
        return { errors: state.errors, applied: false };
      }
      this.state = state;
      this.sources = texts;
      return { errors: [], applied: true };
    }

    this.state.errors.length = 0;
    const { program, errors: parseErrors } = parseProgramIncremental(expandedText);
    if (!program) {
      const errors = parseErrors.length ? parseErrors : [createError("SES009", "Parser error.")];
      return { errors, applied: false };
    }
    compileProgram(program, {
      state: this.state,
      projectEntityAttributes: this.options.projectEntityAttributes,
    });
    if (parseErrors.length) {
      const merged = [...parseErrors, ...this.state.errors];
      this.state.errors.length = 0;
      this.state.errors.push(...merged);
    }
    if (this.state.errors.length === 0) {
      this.sources.push(expandedText);
    }
    return { errors: this.state.errors, applied: this.state.errors.length === 0 };
  }

  execute(cnlText, options = {}) {
    if (hasLoadDirectives(cnlText)) {
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

    for (const segment of expanded.segments) {
      const result = this.learnText(segment.text, {
        transactional: false,
        incremental: true,
        source: segment.path,
      });
      if (result?.errors?.length) {
        const first = result.errors[0];
        const message = first?.message ?? "Failed to load base theory.";
        throw new Error(`CNLSession autoloadBase failed: ${message}`);
      }
    }

    const issues = analyzeCrossOntologyDuplicates(expanded.files, { includeBenign: this.options.reportBenignTheoryDuplicates });
    mergeIssuesIntoDictionaryWarnings(this.state.dictionary, issues, { issueKeyPrefix: "theory" });
  }

  #compileSources(texts) {
    const state = createCompilerState(this.options);
    for (const text of texts) {
      state.errors.length = 0;
      const ast = this.#parseSafe(text, state);
      if (!ast) {
        break;
      }
      compileProgram(ast, {
        state,
        projectEntityAttributes: this.options.projectEntityAttributes,
      });
      if (state.errors.length > 0) {
        break;
      }
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
