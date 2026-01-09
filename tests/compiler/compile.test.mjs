import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { ConceptKind } from "../../src/ids/interners.mjs";

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
