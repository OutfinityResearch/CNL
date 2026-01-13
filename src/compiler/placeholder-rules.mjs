import { ConceptKind } from "../ids/interners.mjs";
import { Plans } from "../plans/ir.mjs";
import { canonicalEntityKey } from "./canonical-keys.mjs";

function isPlaceholderName(value) {
  return typeof value === "string" && /^[A-Z]$/.test(value);
}

function nameValue(node) {
  return node && node.kind === "Name" ? node.value : null;
}

function resolveEntityId(node, state) {
  const key = canonicalEntityKey(node);
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Entity, key);
  return state.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

function resolveUnaryIdFromComplement(complement, state) {
  if (!complement) return null;
  if (complement.kind === "Name") {
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, `U:${complement.value}`);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  if (complement.kind === "NounPhrase") {
    const key = `U:${(complement.core ?? []).join(" ")}`;
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, key);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  return null;
}

function predIdFromRelationAssertion(assertion, state) {
  if (!assertion) return null;
  if (assertion.kind === "ActiveRelationAssertion") {
    const parts = [];
    const vg = assertion.verbGroup;
    if (vg?.auxiliary) parts.push(`aux:${vg.auxiliary}`);
    parts.push(vg?.verb ?? "");
    (vg?.particles ?? []).forEach((p) => parts.push(p));
    const key = `P:${parts.join("|")}`;
    const conceptId = state.idStore.internConcept(ConceptKind.Predicate, key);
    return state.idStore.getDenseId(ConceptKind.Predicate, conceptId);
  }
  if (assertion.kind === "PassiveRelationAssertion") {
    const key = `P:passive:${assertion.verb}|${assertion.preposition}`;
    const conceptId = state.idStore.internConcept(ConceptKind.Predicate, key);
    return state.idStore.getDenseId(ConceptKind.Predicate, conceptId);
  }
  return null;
}

function flattenAtomicConditions(condition) {
  if (!condition) return null;
  if (condition.kind === "AtomicCondition") return [condition.assertion];
  if (condition.kind === "AndChain") {
    const assertions = [];
    for (const item of condition.items ?? []) {
      if (item.kind !== "AtomicCondition") return null;
      assertions.push(item.assertion);
    }
    return assertions;
  }
  return null;
}

function isRelationAssertion(assertion) {
  return assertion && (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion");
}

function isUnaryAssertion(assertion) {
  return assertion && assertion.kind === "CopulaPredicateAssertion";
}

function asRelationTriple(assertion) {
  if (!isRelationAssertion(assertion)) return null;
  const s = nameValue(assertion.subject);
  const o = nameValue(assertion.object);
  if (!s || !o) return null;
  return { s, o };
}

function asUnaryPair(assertion) {
  if (!isUnaryAssertion(assertion)) return null;
  const s = nameValue(assertion.subject);
  if (!s) return null;
  return { s, complement: assertion.complement };
}

export function tryCompilePlaceholderConditional(sentence, state) {
  if (!sentence || sentence.kind !== "ConditionalSentence") return null;

  const bodyAssertions = flattenAtomicConditions(sentence.condition);
  if (!bodyAssertions || bodyAssertions.length === 0) return null;
  if (!sentence.then || sentence.then.kind !== "AssertionSentence") return null;
  const headAssertion = sentence.then.assertion;

  // A) Relation composition: X R Y and Y S Z -> X T Z
  if (bodyAssertions.length === 2 && isRelationAssertion(headAssertion)) {
    const a1 = asRelationTriple(bodyAssertions[0]);
    const a2 = asRelationTriple(bodyAssertions[1]);
    const h = asRelationTriple(headAssertion);
    if (a1 && a2 && h) {
      if (isPlaceholderName(a1.s) && isPlaceholderName(a1.o) && isPlaceholderName(a2.s) && isPlaceholderName(a2.o)) {
        if (isPlaceholderName(h.s) && isPlaceholderName(h.o)) {
          if (a1.o === a2.s && a1.s === h.s && a2.o === h.o) {
            const leftPredId = predIdFromRelationAssertion(bodyAssertions[0], state);
            const rightPredId = predIdFromRelationAssertion(bodyAssertions[1], state);
            const headPredId = predIdFromRelationAssertion(headAssertion, state);
            if (
              Number.isInteger(leftPredId) &&
              Number.isInteger(rightPredId) &&
              Number.isInteger(headPredId)
            ) {
              return {
                kind: "RelationRulePlan",
                relation: Plans.compose(Plans.baseRelation(leftPredId), Plans.baseRelation(rightPredId)),
                headPredId,
              };
            }
          }
        }
      }
    }
  }

  // B) Relation inverse mapping: X R Y -> Y S X
  if (bodyAssertions.length === 1 && isRelationAssertion(bodyAssertions[0]) && isRelationAssertion(headAssertion)) {
    const a = asRelationTriple(bodyAssertions[0]);
    const h = asRelationTriple(headAssertion);
    if (a && h && isPlaceholderName(a.s) && isPlaceholderName(a.o) && isPlaceholderName(h.s) && isPlaceholderName(h.o)) {
      const bodyPredId = predIdFromRelationAssertion(bodyAssertions[0], state);
      const headPredId = predIdFromRelationAssertion(headAssertion, state);
      if (Number.isInteger(bodyPredId) && Number.isInteger(headPredId)) {
        if (a.s === h.o && a.o === h.s) {
          return {
            kind: "RelationRulePlan",
            relation: Plans.inverseRelation(bodyPredId),
            headPredId,
          };
        }
        if (a.s === h.s && a.o === h.o) {
          return {
            kind: "RelationRulePlan",
            relation: Plans.baseRelation(bodyPredId),
            headPredId,
          };
        }
      }
    }
  }

  // C) Unary typing: X is a c -> X is a d
  if (bodyAssertions.length === 1 && isUnaryAssertion(bodyAssertions[0]) && isUnaryAssertion(headAssertion)) {
    const a = asUnaryPair(bodyAssertions[0]);
    const h = asUnaryPair(headAssertion);
    if (a && h && isPlaceholderName(a.s) && isPlaceholderName(h.s) && a.s === h.s) {
      const bodyUnaryId = resolveUnaryIdFromComplement(a.complement, state);
      const headUnaryId = resolveUnaryIdFromComplement(h.complement, state);
      if (Number.isInteger(bodyUnaryId) && Number.isInteger(headUnaryId)) {
        return {
          kind: "RulePlan",
          body: Plans.unarySet(bodyUnaryId),
          head: { kind: "UnaryEmit", unaryId: headUnaryId, subjectPlan: null },
        };
      }
    }
  }

  // D) Binary -> unary typing (subject side): X R Y -> X is a c
  if (bodyAssertions.length === 1 && isRelationAssertion(bodyAssertions[0]) && isUnaryAssertion(headAssertion)) {
    const rel = bodyAssertions[0];
    const relS = nameValue(rel.subject);
    const relO = nameValue(rel.object);
    const h = asUnaryPair(headAssertion);
    if (!relS || !relO || !h) return null;
    if (!isPlaceholderName(h.s)) return null;

    const predId = predIdFromRelationAssertion(rel, state);
    const unaryId = resolveUnaryIdFromComplement(h.complement, state);
    if (!Number.isInteger(predId) || !Number.isInteger(unaryId)) return null;

    // Head variable is the relation subject variable.
    if (h.s === relS && isPlaceholderName(relS)) {
      if (!isPlaceholderName(relO)) {
        const objectId = resolveEntityId(rel.object, state);
        if (objectId === null) return null;
        return {
          kind: "RulePlan",
          body: Plans.preimage(predId, Plans.entitySet(objectId)),
          head: { kind: "UnaryEmit", unaryId, subjectPlan: null },
        };
      }
      return {
        kind: "RulePlan",
        body: Plans.preimage(predId, Plans.allEntities()),
        head: { kind: "UnaryEmit", unaryId, subjectPlan: null },
      };
    }

    // Head variable is the relation object variable.
    if (h.s === relO && isPlaceholderName(relO)) {
      if (!isPlaceholderName(relS)) {
        const subjectId = resolveEntityId(rel.subject, state);
        if (subjectId === null) return null;
        return {
          kind: "RulePlan",
          body: Plans.image(predId, Plans.entitySet(subjectId)),
          head: { kind: "UnaryEmit", unaryId, subjectPlan: null },
        };
      }
      return {
        kind: "RulePlan",
        body: Plans.image(predId, Plans.allEntities()),
        head: { kind: "UnaryEmit", unaryId, subjectPlan: null },
      };
    }
  }

  return null;
}
