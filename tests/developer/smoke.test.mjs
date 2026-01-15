import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { executeProgram } from "../../src/runtime/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

test("smoke: parse → compile → execute", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  const ast = parseProgram(`
Mary is a person.
Every person is mortal.
Command: Verify that Mary is mortal.
  `);

  const out = executeProgram(ast, session.state);
  assert.equal(out.kind, "ProgramResult");
  assert.equal(out.errors.length, 0);
  assert.equal(out.results.length, 1);

  const result = out.results[0].result;
  assert.equal(result.kind, "ProofResult");
  assert.equal(result.value, true);
});
