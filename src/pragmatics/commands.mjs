import { parseProgram } from "../parser/grammar.mjs";

export function parseCommand(source) {
  const text = String(source ?? "");
  if (!text.trim()) {
    throw new Error("parseCommand requires non-empty input.");
  }
  const ast = parseProgram(text);
  const commands = ast.items.filter((item) => item.kind === "CommandStatement");
  if (commands.length === 0) {
    throw new Error("No command found in input.");
  }
  if (commands.length !== ast.items.length) {
    throw new Error("Command input must not include statements.");
  }
  return commands[0].command;
}
