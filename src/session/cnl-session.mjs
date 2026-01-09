import fs from "node:fs";
import { parseProgram } from "../parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../compiler/compile.mjs";

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
    this.options = { projectEntityAttributes: false, ...options };
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

  query() {
    return { error: createError("SES002", "Query is not implemented.") };
  }

  proof() {
    return { error: createError("SES003", "Proof is not implemented.") };
  }

  explain() {
    return { error: createError("SES004", "Explain is not implemented.") };
  }

  solve() {
    return { error: createError("SES005", "Solve is not implemented.") };
  }

  plan() {
    return { error: createError("SES006", "Plan is not implemented.") };
  }

  simulate() {
    return { error: createError("SES007", "Simulate is not implemented.") };
  }

  optimize() {
    return { error: createError("SES008", "Optimize is not implemented.") };
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
}
