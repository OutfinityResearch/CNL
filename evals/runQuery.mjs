import { parseProgram } from "../src/parser/grammar.mjs";
import { compileProgram } from "../src/compiler/compile.mjs";
import { executeCommandAst } from "../src/runtime/engine.mjs";
import { runCaseSuite } from "./cases-runner.mjs";

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  return key;
}

function summarizeQuery(result) {
  if (!result || result.kind !== "QueryResult") return "";
  return result.entities.map((entry) => displayEntityKey(entry.key)).join(", ");
}

async function evaluate({ input }) {
  const ast = parseProgram(input);
  const state = compileProgram(ast);
  if (state.errors.length > 0) {
    return { error: `compiler errors (${state.errors.length})` };
  }
  const commandItem = ast.items.find((item) => item.kind === "CommandStatement");
  if (!commandItem) {
    return { error: "missing command" };
  }
  return executeCommandAst(commandItem.command, state);
}

function compare(expected, output) {
  if (!output || output.kind !== "QueryResult") return false;
  return summarizeQuery(output) === String(expected);
}

const fileUrl = new URL("./query/basic.cases", import.meta.url);
await runCaseSuite({
  fileUrl,
  title: "Query",
  evaluate,
  compare,
  formatOutput: summarizeQuery,
});
