import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";

function summarizeSimulation(result) {
  if (!result || result.kind !== "SimulationResult") return "";
  return `steps=${result.steps}`;
}

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

function compare(testCase, output) {
  return summarizeSimulation(output) === String(testCase.expect);
}

const fileUrl = new URL("../../evals/simulate/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Simulate",
  evaluate,
  compare,
  formatOutput: summarizeSimulation,
});
