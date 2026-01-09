import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { ConceptKind } from "../../src/ids/interners.mjs";
import { canonicalEntityKey, canonicalAttributeKey } from "../../src/compiler/canonical-keys.mjs";

const source = `--- CONTEXT: BaseDictionary ---
"status" is an entity attribute.
--- CONTEXT: Core ---
Truck_A has a status of Active.`;

test("entity-valued attributes project into derived predicate when enabled", () => {
  const ast = parseProgram(source);
  const state = compileProgram(ast, { projectEntityAttributes: true });
  assert.equal(state.errors.length, 0);

  const truckConcept = state.idStore.internConcept(ConceptKind.Entity, "E:Truck_A");
  const activeConcept = state.idStore.internConcept(ConceptKind.Entity, "E:Active");
  const attrConcept = state.idStore.internConcept(ConceptKind.Attribute, "A:status");
  const predConcept = state.idStore.internConcept(ConceptKind.Predicate, "P:has_attr|status");

  const truckId = state.idStore.getDenseId(ConceptKind.Entity, truckConcept);
  const activeId = state.idStore.getDenseId(ConceptKind.Entity, activeConcept);
  const attrId = state.idStore.getDenseId(ConceptKind.Attribute, attrConcept);
  const predId = state.idStore.getDenseId(ConceptKind.Predicate, predConcept);

  const kbState = state.kb.kb;
  assert.ok(kbState.entAttrIndex[attrId].values[truckId].hasBit(activeId));
  assert.ok(kbState.relations[predId].rows[truckId].hasBit(activeId));
});

test("literal objects share EntityID between KB facts and plans", () => {
  const sourceWithLiteral = `Truck_A likes "Pizza".
If Truck_A likes "Pizza", then Truck_A is happy.`;
  const ast = parseProgram(sourceWithLiteral);
  const state = compileProgram(ast);
  assert.equal(state.errors.length, 0);

  const truckKey = canonicalEntityKey({ kind: "Name", value: "Truck_A" });
  const pizzaKey = canonicalEntityKey({ kind: "StringLiteral", value: "Pizza" });
  const truckConcept = state.idStore.internConcept(ConceptKind.Entity, truckKey);
  const pizzaConcept = state.idStore.internConcept(ConceptKind.Entity, pizzaKey);
  const predConcept = state.idStore.internConcept(ConceptKind.Predicate, "P:likes");

  const truckId = state.idStore.getDenseId(ConceptKind.Entity, truckConcept);
  const pizzaId = state.idStore.getDenseId(ConceptKind.Entity, pizzaConcept);
  const predId = state.idStore.getDenseId(ConceptKind.Predicate, predConcept);

  assert.ok(state.kb.kb.relations[predId].rows[truckId].hasBit(pizzaId));

  const rule = state.ruleStore.getRules()[0];
  const body = rule.body;
  assert.equal(body.op, "Intersect");
  const preimage = body.plans.find((plan) => plan.op === "Preimage");
  assert.ok(preimage);
  assert.equal(preimage.objectSet.op, "EntitySet");
  assert.equal(preimage.objectSet.entityId, pizzaId);
});

test("attribute keys include prepositional phrases in plans and KB", () => {
  const sourceWithAttribute = `Truck_A has a distance to Depot_1 of 10.
If Truck_A has a distance to Depot_1 of 10, then Truck_A is near.`;
  const ast = parseProgram(sourceWithAttribute);
  const state = compileProgram(ast);
  assert.equal(state.errors.length, 0);

  const truckKey = canonicalEntityKey({ kind: "Name", value: "Truck_A" });
  const truckConcept = state.idStore.internConcept(ConceptKind.Entity, truckKey);
  const truckId = state.idStore.getDenseId(ConceptKind.Entity, truckConcept);

  const attrKey = canonicalAttributeKey({
    kind: "AttributeRef",
    core: ["distance"],
    pp: [{ kind: "PrepositionalPhrase", preposition: "to", object: { kind: "Name", value: "Depot_1" } }],
  });
  const attrConcept = state.idStore.internConcept(ConceptKind.Attribute, attrKey);
  const attrId = state.idStore.getDenseId(ConceptKind.Attribute, attrConcept);

  const numeric = state.kb.kb.numericIndex[attrId];
  assert.ok(numeric.hasValue.hasBit(truckId));
  assert.equal(numeric.values[truckId], 10);

  const rule = state.ruleStore.getRules()[0];
  const body = rule.body;
  assert.equal(body.op, "Intersect");
  const filter = body.plans.find((plan) => plan.op === "NumFilter");
  assert.ok(filter);
  assert.equal(filter.attrId, attrId);
});
