import { Plans } from "../plans/ir.mjs";
import { ConceptKind } from "../ids/interners.mjs";

function canonicalEntityKey(value) {
  return `E:${value}`;
}

function resolveEntityId(node, context) {
  if (!node || !context?.idStore) return null;
  const value = node.value ?? node.name ?? node.raw;
  if (value === undefined || value === null) return null;
  const conceptId = context.idStore.internConcept(
    ConceptKind.Entity,
    canonicalEntityKey(value)
  );
  return context.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

export function compileNP(node, context) {
  if (!node) return Plans.allEntities();
  if (node.kind === "Name") {
    const entityId = resolveEntityId(node, context);
    return entityId === null ? Plans.allEntities() : Plans.entitySet(entityId);
  }
  return Plans.allEntities();
}

export function compileCondition(node, universePlan, context) {
  if (!node) return universePlan ?? Plans.allEntities();
  if (node.kind === "Not") {
    return Plans.not(compileCondition(node.operand, universePlan, context), universePlan);
  }
  if (node.kind === "And") {
    return Plans.intersect(node.operands.map((item) => compileCondition(item, universePlan, context)));
  }
  if (node.kind === "Or") {
    return Plans.union(node.operands.map((item) => compileCondition(item, universePlan, context)));
  }
  return universePlan ?? Plans.allEntities();
}

export function compileRuleBody(node, context) {
  return compileCondition(node, Plans.allEntities(), context);
}

export function compileRuleHead(node) {
  return node;
}

export function compileCommand(node, context) {
  return {
    node,
    plan: compileCondition(node.condition, Plans.allEntities(), context),
  };
}
