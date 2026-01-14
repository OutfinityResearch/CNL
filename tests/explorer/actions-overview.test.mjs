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

test("actions overview lists actions with preconditions and effects", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
Action: move A to B.
Agent: a robot.
Precondition: Robot_1 is located at A.
Effect: Robot_1 is located at B.
  `);

  const overview = buildOverview("actions", makeContext(session));
  assert.equal(overview.kind, "actions");
  assert.equal(overview.summary.count, 1);
  assert.equal(overview.items[0].name, "move A to B.");
  assert.equal(overview.items[0].agent, "a robot.");
  assert.equal(overview.items[0].preconditions.length, 1);
  assert.equal(overview.items[0].effects.length, 1);
});

