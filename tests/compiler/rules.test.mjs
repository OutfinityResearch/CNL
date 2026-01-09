import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";
import { ConceptKind } from "../../src/ids/interners.mjs";

const source = `Server1 handles Payments.
Rule: If Server1 handles Payments, then Server1 is encrypted.`;

test("compiler produces rule plans that can be applied", () => {
  const ast = parseProgram(source);
  const state = compileProgram(ast);
  assert.equal(state.errors.length, 0);

  const added = state.ruleStore.applyRules(state.kb);
  assert.equal(added, 1);

  const encryptedConcept = state.idStore.internConcept(ConceptKind.UnaryPredicate, "U:encrypted");
  const serverConcept = state.idStore.internConcept(ConceptKind.Entity, "E:Server1");
  const unaryId = state.idStore.getDenseId(ConceptKind.UnaryPredicate, encryptedConcept);
  const serverId = state.idStore.getDenseId(ConceptKind.Entity, serverConcept);

  assert.ok(state.kb.kb.unaryIndex[unaryId].hasBit(serverId));
});
