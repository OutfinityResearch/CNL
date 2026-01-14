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
    rawKb: session.state.kb.kb,
    idStore: session.state.idStore,
    ruleStore: session.state.ruleStore,
    actionStore: session.state.actionStore,
  };
}

test("rules overview detects duplicate rules by natural text", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
Every man is mortal.
Every man is mortal.
Every person is mortal.
  `);

  const overview = buildOverview("rules", makeContext(session));
  assert.equal(overview.kind, "rules");
  // Duplicate rule is deduped in the rule store, but still reported via duplicates.
  assert.equal(overview.summary.count, 2);
  assert.ok(Array.isArray(overview.duplicates));
  assert.equal(overview.duplicates.length, 1);
  assert.equal(overview.duplicates[0].count, 2);
  assert.ok(String(overview.duplicates[0].natural).includes("mortal"));
  assert.deepEqual(overview.duplicates[0].ids.length, 1);
});

test("rules overview excludes transition rules and reports them separately", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
Light_1 is red.
When Light_1 is red occurs, then Light_1 is green.
Every man is mortal.
  `);

  const overview = buildOverview("rules", makeContext(session));
  assert.equal(overview.kind, "rules");
  assert.equal(overview.summary.count, 1);
  assert.equal(overview.summary.transitions, 1);
});
