import test from "node:test";
import assert from "node:assert/strict";

import { parseCommand } from "../../src/pragmatics/commands.mjs";

test("parseCommand parses an inline command statement", () => {
  const command = parseCommand("Return the name of every user.");
  assert.equal(command.kind, "ReturnCommand");
});

test("parseCommand rejects mixed statements+commands", () => {
  assert.throws(() => parseCommand("John likes pizza.\nReturn John."), /must not include statements/i);
});
