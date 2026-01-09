import fs from "node:fs";
import { parseProgram } from "../parser/grammar.mjs";
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
    const ast = this.#parseSafe(cnlText);
    if (!ast) {
      return { errors: this.state.errors, applied: false };
    }
    compileProgram(ast, {
      state: this.state,
      projectEntityAttributes: this.options.projectEntityAttributes,
    });
    if (this.state.errors.length === 0) {
      this.sources.push(cnlText);
    }
    return { errors: this.state.errors, applied: this.state.errors.length === 0 };
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

  solve() {
    return { error: createError("SES005", "Solve is not supported by the grammar.") };
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
