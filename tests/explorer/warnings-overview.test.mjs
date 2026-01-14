import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { buildOverview } from "../../tools/explorer/server/api/routes/overview.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

function makeContext(session) {
  return {
    session,
    rawKb: session.state.kb.kb,
    idStore: session.state.idStore,
    ruleStore: session.state.ruleStore,
    actionStore: session.state.actionStore,
  };
}

test("warnings overview aggregates duplicate rules and dictionary duplicates", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
--- CONTEXT: BaseDictionary ---
"year" is a type.
"year" is a "binary predicate".

--- CONTEXT: Core ---
Every man is mortal.
Every man is mortal.
  `);

  const overview = buildOverview("warnings", makeContext(session));
  assert.equal(overview.kind, "warnings");
  assert.ok(Array.isArray(overview.items));
  assert.ok(overview.items.some((g) => g.kind === "TypeBinaryPredicateConflict" && g.severity === "error"));
  assert.ok(overview.items.some((g) => g.kind === "DuplicateRule" && g.severity === "warning"));
});
