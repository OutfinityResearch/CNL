import { ConceptKind } from "../../ids/interners.mjs";
import { RelationOp, SetOp } from "../../plans/ir.mjs";

function lookupKey(state, kind, denseId) {
  const conceptId = state.idStore.getConceptualId(kind, denseId);
  return conceptId ? state.idStore.lookupKey(conceptId) : null;
}

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function displayUnaryKey(key) {
  if (!key) return "";
  if (key.startsWith("U:not|")) return `not ${key.slice("U:not|".length)}`;
  if (key.startsWith("U:")) return key.slice(2);
  return key;
}

function describeUnary(unaryName) {
  const name = String(unaryName || "").trim();
  if (!name) return "something";
  if (name.startsWith("not ")) return `something that is ${name}`;
  return `something that is a ${name}`;
}

function displayPredPhrase(key) {
  if (!key) return "";
  let verb = key.startsWith("P:") ? key.slice(2) : key;
  let negated = false;
  if (verb.startsWith("not|")) {
    negated = true;
    verb = verb.slice("not|".length);
  }
  let passive = false;
  if (verb.startsWith("passive:")) {
    passive = true;
    verb = verb.slice("passive:".length);
  }
  const phrase = verb.split("|").join(" ");
  if (passive && negated) return `is not ${phrase}`;
  if (passive) return `is ${phrase}`;
  return negated ? `does not ${phrase}` : phrase;
}

function displayAttrKey(key) {
  if (!key) return "";
  if (key.startsWith("A:")) return key.slice(2);
  return key;
}

function describeObjectSet(plan, state) {
  if (!plan || plan.kind !== "SetPlan") return "something";
  switch (plan.op) {
    case SetOp.EntitySet: {
      const key = lookupKey(state, ConceptKind.Entity, plan.entityId);
      return displayEntityKey(key) || `Entity_${plan.entityId}`;
    }
    case SetOp.UnarySet: {
      const key = lookupKey(state, ConceptKind.UnaryPredicate, plan.unaryId);
      const name = displayUnaryKey(key) || `Unary_${plan.unaryId}`;
      return describeUnary(name);
    }
    default:
      return "something";
  }
}

function describeBody(plan, state) {
  if (!plan || plan.kind !== "SetPlan") return "something";
  switch (plan.op) {
    case SetOp.AllEntities:
      return "something";
    case SetOp.UnarySet: {
      const key = lookupKey(state, ConceptKind.UnaryPredicate, plan.unaryId);
      const name = displayUnaryKey(key) || `Unary_${plan.unaryId}`;
      return describeUnary(name);
    }
    case SetOp.Preimage: {
      const predKey = lookupKey(state, ConceptKind.Predicate, plan.predId);
      const phrase = displayPredPhrase(predKey) || `pred_${plan.predId}`;
      const obj = describeObjectSet(plan.objectSet, state);
      return `something that ${phrase} ${obj}`;
    }
    case SetOp.Intersect: {
      const parts = (plan.plans ?? []).map((p) => describeBody(p, state)).filter(Boolean);
      if (parts.length === 0) return "something";
      return parts.join(" and ");
    }
    case SetOp.Union: {
      const parts = (plan.plans ?? []).map((p) => describeBody(p, state)).filter(Boolean);
      if (parts.length === 0) return "something";
      return parts.join(" or ");
    }
    case SetOp.NumFilter: {
      const attrKey = lookupKey(state, ConceptKind.Attribute, plan.attrId);
      const attr = displayAttrKey(attrKey) || `attr_${plan.attrId}`;
      return `something whose ${attr} is ${plan.comparator} ${plan.value}`;
    }
    case SetOp.AttrEntityFilter: {
      const attrKey = lookupKey(state, ConceptKind.Attribute, plan.attrId);
      const attr = displayAttrKey(attrKey) || `attr_${plan.attrId}`;
      const obj = describeObjectSet(plan.valueSet, state);
      return `something whose ${attr} matches ${obj}`;
    }
    case SetOp.Not: {
      const inner = describeBody(plan.plan, state);
      return `something such that it is not the case that (${inner})`;
    }
    default:
      return "something";
  }
}

function describeHead(head, state) {
  if (!head) return "no effect";
  if (head.kind === "UnaryEmit") {
    const key = lookupKey(state, ConceptKind.UnaryPredicate, head.unaryId);
    const name = displayUnaryKey(key) || `Unary_${head.unaryId}`;
    if (name.startsWith("not ")) return `something is ${name}`;
    return `something is a ${name}`;
  }
  if (head.kind === "BinaryEmit") {
    const predKey = lookupKey(state, ConceptKind.Predicate, head.predId);
    const phrase = displayPredPhrase(predKey) || `pred_${head.predId}`;
    const obj = describeObjectSet(head.objectSet, state);
    return `something ${phrase} ${obj}`;
  }
  if (head.kind === "AttrEmit") {
    const attrKey = lookupKey(state, ConceptKind.Attribute, head.attrId);
    const attr = displayAttrKey(attrKey) || `attr_${head.attrId}`;
    if (head.valueType === "numeric") {
      return `something has a ${attr} of ${head.value}`;
    }
    if (head.valueType === "entity") {
      const obj = describeObjectSet(head.valueSet, state);
      return `something has a ${attr} of ${obj}`;
    }
    return `something has a ${attr}`;
  }
  return "rule head";
}

export function renderRuleSummary(ruleId, state) {
  if (!state?.ruleStore || !Number.isInteger(ruleId)) return null;
  const rules = state.ruleStore.getRules();
  const rule = rules[ruleId];
  if (!rule) return null;
  if (rule.kind === "RelationRulePlan") {
    const headKey = lookupKey(state, ConceptKind.Predicate, rule.headPredId);
    const headPhrase = displayPredPhrase(headKey) || `pred_${rule.headPredId}`;
    const rel = rule.relation;
    if (!rel || rel.kind !== "RelationPlan") {
      return `If something is related, then something ${headPhrase} something.`;
    }
    if (rel.op === RelationOp.BaseRelation) {
      const bodyKey = lookupKey(state, ConceptKind.Predicate, rel.predId);
      const bodyPhrase = displayPredPhrase(bodyKey) || `pred_${rel.predId}`;
      return `If something ${bodyPhrase} something, then something ${headPhrase} something.`;
    }
    if (rel.op === RelationOp.InverseRelation) {
      const bodyKey = lookupKey(state, ConceptKind.Predicate, rel.predId);
      const bodyPhrase = displayPredPhrase(bodyKey) || `pred_${rel.predId}`;
      return `If something ${bodyPhrase} something, then something ${headPhrase} something (reversed).`;
    }
    if (rel.op === RelationOp.Compose) {
      const left = rel.left;
      const right = rel.right;
      const leftKey =
        left && left.kind === "RelationPlan" && left.op === RelationOp.BaseRelation
          ? lookupKey(state, ConceptKind.Predicate, left.predId)
          : null;
      const rightKey =
        right && right.kind === "RelationPlan" && right.op === RelationOp.BaseRelation
          ? lookupKey(state, ConceptKind.Predicate, right.predId)
          : null;
      const leftPhrase = displayPredPhrase(leftKey) || "relates to";
      const rightPhrase = displayPredPhrase(rightKey) || "relates to";
      return `If something ${leftPhrase} something and that something ${rightPhrase} something, then something ${headPhrase} something.`;
    }
    return `If something is related, then something ${headPhrase} something.`;
  }
  if (rule.kind !== "RulePlan") return null;
  if (rule.head?.kind === "UnaryEmit" && rule.body?.kind === "SetPlan" && rule.body.op === SetOp.UnarySet) {
    const bodyKey = lookupKey(state, ConceptKind.UnaryPredicate, rule.body.unaryId);
    const headKey = lookupKey(state, ConceptKind.UnaryPredicate, rule.head.unaryId);
    const bodyName = displayUnaryKey(bodyKey) || `Unary_${rule.body.unaryId}`;
    const headName = displayUnaryKey(headKey) || `Unary_${rule.head.unaryId}`;
    return `Every ${bodyName} is ${headName}.`;
  }
  const body = describeBody(rule.body, state);
  const head = describeHead(rule.head, state);
  return `If ${body}, then ${head}.`;
}
