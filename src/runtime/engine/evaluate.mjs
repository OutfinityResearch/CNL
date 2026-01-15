import { Plans } from "../../plans/ir.mjs";
import { executeSet } from "../../plans/execute.mjs";
import { compileCondition, compileNP } from "../../compiler/ast-to-plan.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { isUniversalNounPhrase, resolveEntityId, resolvePredId, resolveUnaryId } from "./helpers.mjs";

function triNotProvable(value) {
  return value === "true" ? "false" : "true";
}

function triAnd(values) {
  let sawUnknown = false;
  for (const v of values) {
    if (v === "false") return "false";
    if (v === "unknown") sawUnknown = true;
  }
  return sawUnknown ? "unknown" : "true";
}

function triOr(values) {
  let sawUnknown = false;
  for (const v of values) {
    if (v === "true") return "true";
    if (v === "unknown") sawUnknown = true;
  }
  return sawUnknown ? "unknown" : "false";
}

function triForAtomicAssertion(assertion, state) {
  if (!assertion) return "unknown";

  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    if (subjectId === null) return "unknown";
    const claimId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
    const complementId = resolveUnaryId(assertion.complement, state, { negated: !assertion.negated });
    if (claimId === null || complementId === null) return "unknown";
    const kb = state.kb.kb;
    const claimSet = kb.unaryIndex[claimId];
    const complementSet = kb.unaryIndex[complementId];
    const hasClaim = Boolean(claimSet && subjectId >= 0 && subjectId < claimSet.size && claimSet.hasBit(subjectId));
    const hasComplement = Boolean(
      complementSet && subjectId >= 0 && subjectId < complementSet.size && complementSet.hasBit(subjectId),
    );
    if (hasClaim) return "true";
    if (hasComplement) return "false";
    return "unknown";
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    if (subjectId === null || objectId === null) return "unknown";

    const predId = resolvePredId(assertion, state);
    if (predId === null) return "unknown";
    const kbApi = state.kb;
    const hasClaim = kbApi.hasBinary(subjectId, predId, objectId);

    const predCid = state.idStore.getConceptualId(ConceptKind.Predicate, predId);
    const baseKey = predCid ? state.idStore.lookupKey(predCid) : null;
    if (typeof baseKey !== "string") return hasClaim ? "true" : "unknown";
    const flippedKey = baseKey.startsWith("P:not|")
      ? baseKey.replace(/^P:not\|/, "P:")
      : baseKey.replace(/^P:/, "P:not|");
    const flippedCid = state.idStore.internConcept(ConceptKind.Predicate, flippedKey);
    const flippedId = state.idStore.getDenseId(ConceptKind.Predicate, flippedCid);
    const hasComplement = Number.isInteger(flippedId) ? kbApi.hasBinary(subjectId, flippedId, objectId) : false;

    if (hasClaim) return "true";
    if (hasComplement) return "false";
    return "unknown";
  }

  return "unknown";
}

export function evaluateConditionTri(condition, state) {
  if (!condition) return "false";

  switch (condition.kind) {
    case "AtomicCondition": {
      const assertion = condition.assertion;
      if (assertion?.subject?.kind === "NounPhrase" && isUniversalNounPhrase(assertion.subject)) {
        const basePlan = compileNP(assertion.subject, state);
        const satisfyPlan = compileCondition(condition, Plans.allEntities(), state);
        const baseSet = executeSet(basePlan, state.kb.kb);
        const satisfySet = executeSet(satisfyPlan, state.kb.kb);
        return baseSet.andNot(satisfySet).isEmpty() ? "true" : "false";
      }
      const tri = triForAtomicAssertion(assertion, state);
      if (tri !== "unknown") return tri;

      const plan = compileCondition(condition, Plans.allEntities(), state);
      return !executeSet(plan, state.kb.kb).isEmpty() ? "true" : "unknown";
    }
    case "AndChain":
      return triAnd(condition.items.map((item) => evaluateConditionTri(item, state)));
    case "OrChain":
      return triOr(condition.items.map((item) => evaluateConditionTri(item, state)));
    case "EitherOr":
      return triOr([evaluateConditionTri(condition.left, state), evaluateConditionTri(condition.right, state)]);
    case "BothAnd":
      return triAnd([evaluateConditionTri(condition.left, state), evaluateConditionTri(condition.right, state)]);
    case "CaseScope":
      if (condition.mode === "negative") {
        return triNotProvable(evaluateConditionTri(condition.operand, state));
      }
      return evaluateConditionTri(condition.operand, state);
    case "GroupCondition":
      return evaluateConditionTri(condition.inner, state);
    default:
      return "false";
  }
}

export function evaluateCondition(condition, state) {
  return evaluateConditionTri(condition, state) === "true";
}
