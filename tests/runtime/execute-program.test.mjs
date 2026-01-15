import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { executeProgram } from "../../src/runtime/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

test("executeProgram runs statements and commands in-order", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  const ast = parseProgram(`
Command: Verify that Mary likes Sushi.
Mary likes Sushi.
Command: Verify that Mary likes Sushi.
  `);

  const out = executeProgram(ast, session.state, { deduce: false });
  assert.equal(out.kind, "ProgramResult");
  assert.equal(out.errors.length, 0);
  assert.equal(out.results.length, 2);

  const first = out.results[0].result;
  const second = out.results[1].result;
  assert.equal(first.kind, "ProofResult");
  assert.equal(first.value, "unknown");
  assert.equal(second.kind, "ProofResult");
  assert.equal(second.value, true);
});
