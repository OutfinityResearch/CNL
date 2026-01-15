import { canonicalEntityKey } from "../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { createBitset } from "../../kb/bitset.mjs";

export function isUniversalNounPhrase(node) {
  if (!node || node.kind !== "NounPhrase") return false;
  const prefix = node.prefix;
  if (!prefix || prefix.kind !== "Quantifier") return false;
  return prefix.q === "every" || prefix.q === "all";
}

export function resolveEntityId(node, state) {
  const key = canonicalEntityKey(node);
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Entity, key);
  return state.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

export function resolveUnaryId(complement, state, options = {}) {
  if (!complement) return null;
  const negated = Boolean(options.negated);
  if (complement.kind === "Name") {
    const key = negated ? `U:not|${complement.value}` : `U:${complement.value}`;
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, key);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  if (complement.kind === "NounPhrase") {
    const core = complement.core.join(" ");
    const key = negated ? `U:not|${core}` : `U:${core}`;
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, key);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  return null;
}

export function verbGroupKey(verbGroup) {
  if (!verbGroup) return null;
  const parts = [];
  if (verbGroup.auxiliary) parts.push(`aux:${verbGroup.auxiliary}`);
  parts.push(verbGroup.verb);
  verbGroup.particles.forEach((particle) => parts.push(particle));
  return `P:${parts.join("|")}`;
}

export function passiveKey(verb, preposition, options = {}) {
  const base = `P:passive:${verb}|${preposition}`;
  if (!options?.negated) return base;
  return base.replace(/^P:/, "P:not|");
}

export function resolvePredId(assertion, state) {
  let key = null;
  if (assertion.kind === "ActiveRelationAssertion") {
    key = verbGroupKey(assertion.verbGroup);
  } else if (assertion.kind === "PassiveRelationAssertion") {
    key = passiveKey(assertion.verb, assertion.preposition, { negated: assertion.negated });
  }
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Predicate, key);
  return state.idStore.getDenseId(ConceptKind.Predicate, conceptId);
}

export function collectEntities(set, state) {
  const entities = [];
  set.iterateSetBits((entityId) => {
    const conceptId = state.idStore.getConceptualId(ConceptKind.Entity, entityId);
    const key = conceptId ? state.idStore.lookupKey(conceptId) : null;
    entities.push({ id: entityId, key });
  });
  return entities;
}

export function isNameProjection(expr) {
  if (!expr || expr.kind !== "NounPhrase") return false;
  if (!expr.core || expr.core.length !== 1) return false;
  if (expr.core[0].toLowerCase() !== "name") return false;
  if (!expr.pp || expr.pp.length !== 1) return false;
  return expr.pp[0].preposition === "of";
}

export function bitsetFactoryFor(kbState) {
  return kbState.bitsetFactory ?? createBitset;
}

export function emptySet(kbState) {
  return bitsetFactoryFor(kbState)(kbState.entitiesCount);
}

export function fullSet(kbState) {
  const set = emptySet(kbState);
  for (let i = 0; i < kbState.entitiesCount; i += 1) {
    set.setBit(i);
  }
  return set;
}

export function entitySet(entityId, kbState) {
  const set = emptySet(kbState);
  if (Number.isInteger(entityId) && entityId >= 0 && entityId < kbState.entitiesCount) {
    set.setBit(entityId);
  }
  return set;
}

export function collectVariables(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.kind === "Variable") {
    set.add(node.name);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectVariables(item, set));
    return;
  }
  Object.values(node).forEach((value) => collectVariables(value, set));
}

export function hasVariables(node) {
  const vars = new Set();
  collectVariables(node, vars);
  return vars.size > 0;
}

export function runtimeError(code, message, primaryToken = "EOF") {
  return {
    code,
    name: "RuntimeError",
    message,
    severity: "error",
    primaryToken,
    hint: "Check solve/optimize constraints.",
  };
}
