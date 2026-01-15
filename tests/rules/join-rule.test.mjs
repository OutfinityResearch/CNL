import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { executeProgram } from "../../src/runtime/engine.mjs";

test("join rule: binary join with variables", () => {
  const session = new CNLSession({ autoloadBase: false });
  const ast = parseProgram(`
--- CONTEXT: BaseDictionary ---
"parent-of" is a "binary predicate".
"grandparent-of" is a "binary predicate".
--- CONTEXT: Core ---
Rule: If ?X parent-of ?Y and ?Y parent-of ?Z then ?X grandparent-of ?Z.
Mary parent-of John.
John parent-of Sue.
Command: Verify that Mary grandparent-of Sue.
  `);

  const out = executeProgram(ast, session.state, { deduce: true });
  assert.equal(out.kind, "ProgramResult");
  assert.equal(out.errors.length, 0);
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].result.kind, "ProofResult");
  assert.equal(out.results[0].result.value, true);
});

