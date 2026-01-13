import fs from "node:fs";
import { parseProgram, parseProgramIncremental } from "../parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../runtime/engine.mjs";

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
    this.options = { projectEntityAttributes: false, validateDictionary: true, ...options };
    this.state = createCompilerState(this.options);
    this.sources = [];
  }

  learn(theoryFile, options = {}) {
    const text = fs.readFileSync(theoryFile, "utf8");
    return this.learnText(text, { ...options, source: theoryFile });
  }

  learnText(cnlText, options = {}) {
    const transactional = options.transactional ?? true;
    const incremental = options.incremental ?? false;

    if (transactional && incremental) {
      return { errors: [createError("SES001", "Transactional and incremental are exclusive.")] };
    }

    if (transactional) {
      const texts = [...this.sources, cnlText];
      const state = this.#compileSources(texts);
      if (state.errors.length > 0) {
        return { errors: state.errors, applied: false };
      }
      this.state = state;
      this.sources = texts;
      return { errors: [], applied: true };
    }

    this.state.errors.length = 0;
    const { program, errors: parseErrors } = parseProgramIncremental(cnlText);
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
      this.sources.push(cnlText);
    }
    return { errors: this.state.errors, applied: this.state.errors.length === 0 };
  }

  execute(cnlText, options = {}) {
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
