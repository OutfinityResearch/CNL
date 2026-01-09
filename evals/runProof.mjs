import { parseProgram } from "../src/parser/grammar.mjs";
import { compileProgram } from "../src/compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";

async function evaluate({ input }) {
  const ast = parseProgram(input);
  const state = compileProgram(ast);
  if (state.errors.length > 0) {
    return { error: `compiler errors (${state.errors.length})` };
  }
  materializeRules(state, { justificationStore: state.justificationStore });
  const commandItem = ast.items.find((item) => item.kind === "CommandStatement");
  if (!commandItem) {
    return { error: "missing command" };
  }
  return executeCommandAst(commandItem.command, state);
}

function compare(expected, output) {
  if (!output || output.kind !== "ProofResult") return false;
  return String(output.value) === String(expected);
}

function formatOutput(output) {
  if (!output || output.kind !== "ProofResult") return "";
  return String(output.value);
}

const fileUrl = new URL("./proof/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Proof",
  evaluate,
  compare,
  formatOutput,
});
