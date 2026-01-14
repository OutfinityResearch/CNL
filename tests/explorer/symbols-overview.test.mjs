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

test("symbols overview includes lower-case constants like flat-earth", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
Claim_1 asserts flat-earth.
  `);

  const overview = buildOverview("symbols", makeContext(session));
  assert.equal(overview.kind, "symbols");
  assert.ok(overview.items.some((s) => s.name === "flat-earth"));
});

