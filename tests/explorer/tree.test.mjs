import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { buildTree } from "../../tools/explorer/server/api/routes/tree.mjs";
import { buildScopedOverview } from "../../tools/explorer/server/api/routes/overview.mjs";

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

function walkTree(nodes, visit) {
  for (const node of nodes || []) {
    visit(node);
    if (Array.isArray(node.children) && node.children.length) walkTree(node.children, visit);
  }
}

test("tree places warnings last and provides open actions for all nodes", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
--- CONTEXT: BaseDictionary ---
"x" is a type.
"x" is a type.

--- CONTEXT: Demo ---
John is a user.
John likes Pizza_1.
Pizza_1 is a food.
Every user is active.
Every user is active.
  `);

  const tree = buildTree(makeContext(session));
  assert.ok(Array.isArray(tree));
  assert.ok(tree.length > 0);

  const last = tree[tree.length - 1];
  assert.equal(last.id, "warnings");

  walkTree(tree, (node) => {
    assert.ok(node.open && node.open.type, `missing open action for node '${node.id}'`);
  });
});

test("relationships are grouped by first relevant concept (subject's first category)", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
John is a user.
Alice is a user.
Pizza_1 is a food.
John likes Pizza_1.
Alice likes Pizza_1.
  `);

  const tree = buildTree(makeContext(session));
  const relations = tree.find((n) => n.id === "relations");
  assert.ok(relations, "missing relationships root node");
  assert.ok(Array.isArray(relations.children));
  assert.ok(relations.children.length > 0);

  const likesNode = relations.children.find((n) => String(n.text).includes("like"));
  assert.ok(likesNode, "missing 'likes' predicate node");
  assert.ok(Array.isArray(likesNode.children) && likesNode.children.length > 0, "likes has no children");

  const hasCategoryGroup = likesNode.children.some((n) => /^p-\d+-c-/.test(String(n.id)));
  assert.equal(hasCategoryGroup, true, "expected predicate to have category grouping children");
});

test("scoped overview resolves relationship fact leaf nodes", () => {
  const session = new CNLSession({ rootDir: PROJECT_ROOT, autoloadBase: false });
  session.learnText(`
John is a user.
Pizza_1 is a food.
John likes Pizza_1.
  `);
  const context = makeContext(session);
  const tree = buildTree(context);

  const relations = tree.find((n) => n.id === "relations");
  assert.ok(relations);
  const predNode = relations.children.find((n) => n.open?.id?.startsWith("p-"));
  assert.ok(predNode, "missing predicate node");
  const catNode = predNode.children.find((n) => n.id.includes("-c-"));
  assert.ok(catNode, "missing category node");
  const subjNode = catNode.children.find((n) => n.id.includes("-s-"));
  assert.ok(subjNode, "missing subject node");
  const factNode = subjNode.children.find((n) => n.id.includes("-o-"));
  assert.ok(factNode, "missing fact leaf node");

  const overview = buildScopedOverview(factNode.open.id, context);
  assert.ok(overview, "missing scoped overview");
  assert.equal(overview.kind, "relation-fact");
  assert.equal(overview.summary.exists, true);
});
