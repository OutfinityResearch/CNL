import { ConceptKind } from "../ids/interners.mjs";
import { canonicalEntityKey } from "./canonical-keys.mjs";
import { verbGroupKey, passiveKey } from "../utils/predicate-keys.mjs";

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

function isTerm(node) {
  return node && (node.kind === "Variable" || node.kind === "Name");
}

function termKey(node) {
  if (!node) return null;
  if (node.kind === "Variable") return `?${node.name}`;
  if (node.kind === "Name") return node.value;
  return null;
}

function internEntityId(term, state) {
  const key = canonicalEntityKey(term);
  if (!key) return null;
  const cid = state.idStore.internConcept(ConceptKind.Entity, key);
  return state.idStore.getDenseId(ConceptKind.Entity, cid);
}

function internUnaryIdFromComplement(complement, state, { negated } = {}) {
  if (!complement) return null;
  const core =
    complement.kind === "Name"
      ? complement.value
      : complement.kind === "NounPhrase"
        ? (complement.core || []).join(" ")
        : null;
  if (!core) return null;
  const key = negated ? `U:not|${core}` : `U:${core}`;
  const cid = state.idStore.internConcept(ConceptKind.UnaryPredicate, key);
  return state.idStore.getDenseId(ConceptKind.UnaryPredicate, cid);
}

function internPredIdFromRelation(assertion, state) {
  if (!assertion) return null;
  if (assertion.kind === "ActiveRelationAssertion") {
    const key = verbGroupKey(assertion.verbGroup, { negated: assertion.negated });
    if (!key) return null;
    const cid = state.idStore.internConcept(ConceptKind.Predicate, key);
    return state.idStore.getDenseId(ConceptKind.Predicate, cid);
  }
  if (assertion.kind === "PassiveRelationAssertion") {
    const key = passiveKey(assertion.verb, assertion.preposition, { negated: assertion.negated });
    if (!key) return null;
    const cid = state.idStore.internConcept(ConceptKind.Predicate, key);
    return state.idStore.getDenseId(ConceptKind.Predicate, cid);
  }
  return null;
}

function varIndexFor(name, map, ordered) {
  if (map.has(name)) return map.get(name);
  const id = ordered.length;
  ordered.push(name);
  map.set(name, id);
  return id;
}

function compileTermRef(term, state, varMap, varNames) {
  if (!term) return null;
  if (term.kind === "Variable") {
    const key = termKey(term);
    return { kind: "var", varId: varIndexFor(key, varMap, varNames) };
  }
  if (term.kind === "Name") {
    const entityId = internEntityId(term, state);
    return entityId === null ? null : { kind: "const", entityId };
  }
  return null;
}

function compileBodyAtom(assertion, state, varMap, varNames) {
  if (!assertion || typeof assertion !== "object") return null;

  if (assertion.kind === "CopulaPredicateAssertion") {
    if (!isTerm(assertion.subject)) return null;
    const subject = compileTermRef(assertion.subject, state, varMap, varNames);
    if (!subject || subject.kind !== "var") return null; // join rules are variable-driven
    const unaryId = internUnaryIdFromComplement(assertion.complement, state, { negated: assertion.negated });
    if (unaryId === null) return null;
    return { kind: "UnaryAtom", unaryId, subjectVar: subject.varId };
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    if (!isTerm(assertion.subject) || !isTerm(assertion.object)) return null;
    const predId = internPredIdFromRelation(assertion, state);
    if (predId === null) return null;
    const subject = compileTermRef(assertion.subject, state, varMap, varNames);
    const object = compileTermRef(assertion.object, state, varMap, varNames);
    if (!subject || !object) return null;
    return { kind: "BinaryAtom", predId, subject, object };
  }

  return null;
}

function compileHeadEmit(assertion, state, varMap, varNames) {
  if (!assertion || typeof assertion !== "object") return null;

  if (assertion.kind === "CopulaPredicateAssertion") {
    if (!isTerm(assertion.subject)) return null;
    const subject = compileTermRef(assertion.subject, state, varMap, varNames);
    if (!subject || subject.kind !== "var") return null;
    const unaryId = internUnaryIdFromComplement(assertion.complement, state, { negated: assertion.negated });
    if (unaryId === null) return null;
    return { kind: "UnaryEmitVar", unaryId, subjectVar: subject.varId };
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    if (!isTerm(assertion.subject) || !isTerm(assertion.object)) return null;
    const predId = internPredIdFromRelation(assertion, state);
    if (predId === null) return null;
    const subject = compileTermRef(assertion.subject, state, varMap, varNames);
    const object = compileTermRef(assertion.object, state, varMap, varNames);
    if (!subject || !object) return null;
    if (subject.kind !== "var") return null;
    return { kind: "BinaryEmitVar", predId, subjectVar: subject.varId, object };
  }

  return null;
}

/**
 * Compiles a conditional rule containing variables into a join-style rule plan.
 * Returns null when the rule is outside the supported join subset.
 */
export function tryCompileJoinRule(sentence, state) {
  if (!sentence || sentence.kind !== "ConditionalSentence") return null;

  const bodyAssertions = flattenAtomicConditions(sentence.condition);
  if (!bodyAssertions || bodyAssertions.length === 0) return null;
  if (!sentence.then || sentence.then.kind !== "AssertionSentence") return null;

  const varMap = new Map();
  const varNames = [];
  const atoms = [];

  for (const assertion of bodyAssertions) {
    const atom = compileBodyAtom(assertion, state, varMap, varNames);
    if (!atom) return null;
    atoms.push(atom);
  }

  const headEmit = compileHeadEmit(sentence.then.assertion, state, varMap, varNames);
  if (!headEmit) return null;

  if (varNames.length === 0) return null;

  return {
    kind: "JoinRulePlan",
    vars: varNames,
    atoms,
    head: headEmit,
  };
}

