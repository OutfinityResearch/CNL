import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { executeCommandAst, materializeRules } from "../../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";
import { displayEntityKey } from "../../src/utils/display-keys.mjs";

function summarizeSolve(result) {
  if (!result || result.kind !== "SolveResult") return "";
  return result.entities.map((entry) => displayEntityKey(entry.key)).join(", ");
}

function listIncludesAll(haystack, needles) {
  if (!Array.isArray(needles) || needles.length === 0) return true;
  const text = Array.isArray(haystack) ? haystack.join("\n") : String(haystack ?? "");
  return needles.every((needle) => text.includes(String(needle)));
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
  const expected = testCase.expect;
  if (!output || output.kind !== "SolveResult") return false;
  if (summarizeSolve(output) !== String(expected)) return false;
  if (testCase.proofMode || testCase.proofStepsInclude || testCase.proofPremisesInclude) {
    const proof = output.proof;
    if (!proof || proof.kind !== "ProofTrace") return false;
    if (testCase.proofMode && proof.mode !== testCase.proofMode) return false;
    if (testCase.proofStepsInclude && !listIncludesAll(proof.steps ?? [], testCase.proofStepsInclude)) return false;
    if (testCase.proofPremisesInclude && !listIncludesAll(proof.premises ?? [], testCase.proofPremisesInclude)) {
      return false;
    }
  }
  return true;
}

const fileUrl = new URL("../../evals/solve/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Solve",
  evaluate,
  compare,
  formatOutput: summarizeSolve,
});
