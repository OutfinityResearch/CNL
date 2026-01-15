import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";

function summarizePlan(result) {
  if (!result || result.kind !== "PlanResult") return "";
  return result.status ?? "";
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
  return summarizePlan(output) === String(testCase.expect);
}

const fileUrl = new URL("../../evals/planning/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Plan",
  evaluate,
  compare,
  formatOutput: summarizePlan,
});
