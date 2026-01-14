import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { ConceptKind } from "../../src/ids/interners.mjs";
import { buildGraph } from "../../tools/explorer/server/api/routes/graph.mjs";
import { getName } from "../../tools/explorer/server/api/helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

function makeContext(session) {
  return {
    sessionId: "test",
    session,
    rawKb: session.state.kb.kb,
    idStore: session.state.idStore,
    ruleStore: session.state.ruleStore,
    actionStore: session.state.actionStore,
  };
}

test("graph includes all user-defined concepts (unary predicates) present in idStore", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT });
  const context = makeContext(session);
  const graph = buildGraph(context);

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const unaryTotal = context.idStore.size(ConceptKind.UnaryPredicate);

  for (let u = 0; u < unaryTotal; u++) {
    const rawName = getName(context.idStore, ConceptKind.UnaryPredicate, u);
    const isUserDefined = rawName && !rawName.startsWith("[");
    if (!isUserDefined) continue;
    assert.ok(nodeIds.has(`c${u}`), `missing concept node for unaryId=${u} (${rawName})`);
  }
});

test("graph includes concept nodes even when they have zero members", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT });
  session.learnText(`
Every test-empty-concept is entity.
  `);
  const context = makeContext(session);
  const graph = buildGraph(context);

  const unaryTotal = context.idStore.size(ConceptKind.UnaryPredicate);
  let found = false;
  for (let u = 0; u < unaryTotal; u++) {
    const name = getName(context.idStore, ConceptKind.UnaryPredicate, u);
    if (name === "test-empty-concept") {
      found = graph.nodes.some((n) => n.id === `c${u}` && n.nodeType === "concept");
      break;
    }
  }
  assert.equal(found, true);
});

test("graph contains an 'is a' edge for a stated type fact", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT });
  session.learnText(`
John is a user.
  `);
  const context = makeContext(session);
  const graph = buildGraph(context);

  const johnNode = graph.nodes.find((n) => n.nodeType === "thing" && n.name === "John");
  assert.ok(johnNode, "missing John thing node");

  const userConcept = graph.nodes.find((n) => n.nodeType === "concept" && n.name === "user");
  assert.ok(userConcept, "missing user concept node");

  const hasEdge = graph.edges.some(
    (e) => e.edgeType === "isa" && e.source === johnNode.id && e.target === userConcept.id
  );
  assert.equal(hasEdge, true);
});
