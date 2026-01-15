import { canonicalAttributeKey } from "../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { hasVariables, resolveEntityId, resolvePredId, resolveUnaryId, runtimeError } from "./helpers.mjs";

export function applyAssertion(assertion, kbApi, state) {
  if (!assertion) return runtimeError("SES025", "Missing assertion in effect.", "Effect");
  if (hasVariables(assertion)) {
    return runtimeError("SES025", "Effects must be ground assertions.", "Effect");
  }

  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const unaryId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
    if (subjectId === null || unaryId === null) {
      return runtimeError("SES025", "Effect requires ground unary assertion.", "Effect");
    }
    kbApi.insertUnary(unaryId, subjectId);
    return null;
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    const predId = resolvePredId(assertion, state);
    if (subjectId === null || objectId === null || predId === null) {
      return runtimeError("SES025", "Effect requires ground binary assertion.", "Effect");
    }
    kbApi.insertBinary(subjectId, predId, objectId);
    return null;
  }

  if (assertion.kind === "AttributeAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    if (subjectId === null) {
      return runtimeError("SES025", "Effect requires ground attribute subject.", "Effect");
    }
    const attrKey = canonicalAttributeKey(assertion.attribute);
    if (!attrKey || !assertion.value) {
      return runtimeError("SES025", "Effect requires attribute value.", "Effect");
    }
    const conceptId = state.idStore.internConcept(ConceptKind.Attribute, attrKey);
    const attrId = state.idStore.getDenseId(ConceptKind.Attribute, conceptId);
    if (assertion.value.kind === "NumberLiteral") {
      kbApi.setNumeric(attrId, subjectId, assertion.value.value);
      return null;
    }
    const valueId = resolveEntityId(assertion.value, state);
    if (valueId === null) {
      return runtimeError("SES025", "Effect requires entity attribute value.", "Effect");
    }
    kbApi.insertEntityAttr(attrId, subjectId, valueId);
    return null;
  }

  return runtimeError("SES025", "Unsupported effect assertion.", assertion.kind);
}

export function applySentenceEffect(sentence, kbApi, state) {
  if (!sentence) return runtimeError("SES025", "Missing effect sentence.", "Effect");
  if (sentence.kind !== "AssertionSentence") {
    return runtimeError("SES025", "Effects must be atomic assertions in v1.", sentence.kind);
  }
  return applyAssertion(sentence.assertion, kbApi, state);
}
