import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";
import { displayEntityKey } from "../../src/utils/display-keys.mjs";

function summarizeResult(result) {
  if (!result) return "";
  switch (result.kind) {
    case "QueryResult":
    case "SolveResult":
      return result.entities.map((entry) => displayEntityKey(entry.key)).join(", ");
    case "ProofResult":
      return String(result.value);
    case "ExplainResult":
      return result.justification?.kind ?? "explain";
    case "PlanResult":
      return result.status ?? "";
    case "SimulationResult":
      return `steps=${result.steps}`;
    case "OptimizeResult":
      return `${result.status}:${result.value}`;
    default:
      return "";
  }
}

async function evaluate({ input }) {
  const ast = parseProgram(input);
  const state = compileProgram(ast);
  if (state.errors.length > 0) {
    return { error: `compiler errors (${state.errors.length})` };
  }
  materializeRules(state, { justificationStore: state.justificationStore });
  const commandItem = [...ast.items].reverse().find((item) => item.kind === "CommandStatement");
  if (!commandItem) {
    return { error: "missing command" };
  }
  return executeCommandAst(commandItem.command, state);
}

function compare(testCase, output) {
  return summarizeResult(output) === String(testCase.expect);
}

const fileUrl = new URL("../../evals/reasoning/mini-theories.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Reasoning",
  evaluate,
  compare,
  formatOutput: summarizeResult,
});
