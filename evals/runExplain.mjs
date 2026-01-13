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

function formatOutput(output) {
  if (!output) return "";
  if (output.error) return output.error;
  if (output.kind === "ExplainResult") {
    const kind = output.justification?.kind ?? "explain";
    const premises = Array.isArray(output.justification?.premiseIds)
      ? output.justification.premiseIds.length
      : 0;
    return `${kind}:${premises}`;
  }
  return output.kind ?? "";
}

const fileUrl = new URL("./explain/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Explain",
  evaluate,
  compare: (testCase, output) => String(testCase.expect) === formatOutput(output),
  formatOutput,
});
