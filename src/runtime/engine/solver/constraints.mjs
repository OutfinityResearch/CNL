import { executeSet } from "../../../plans/execute.mjs";
import { compileNP } from "../../../compiler/ast-to-plan.mjs";
import { canonicalAttributeKey } from "../../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../../ids/interners.mjs";
import {
  collectVariables,
  emptySet,
  entitySet,
  fullSet,
  resolveEntityId,
  resolvePredId,
  resolveUnaryId,
  runtimeError,
} from "../helpers.mjs";

function resolveEntitySet(node, state) {
  if (!node) return emptySet(state.kb.kb);
  if (node.kind === "NounPhrase" || node.kind === "Name") {
    return executeSet(compileNP(node, state), state.kb.kb);
  }
  if (node.kind === "NumberLiteral" || node.kind === "StringLiteral" || node.kind === "BooleanLiteral") {
    const entityId = resolveEntityId(node, state);
    return entitySet(entityId, state.kb.kb);
  }
  return emptySet(state.kb.kb);
}

export function buildSolveConstraints(condition, state, allVariables) {
  const atomic = [];
  const errors = [];

  function walk(node) {
    if (!node) return;
    switch (node.kind) {
      case "AtomicCondition":
        atomic.push(node);
        return;
      case "AndChain":
        node.items.forEach(walk);
        return;
      case "BothAnd":
        walk(node.left);
        walk(node.right);
        return;
      case "GroupCondition":
        walk(node.inner);
        return;
      case "CaseScope":
        if (node.mode === "negative") {
          if (node.operand?.kind === "AtomicCondition") {
            atomic.push({ ...node.operand, negated: true });
            return;
          }
          errors.push(runtimeError("SES021", "Solve negation is only supported for atomic constraints.", "not"));
          return;
        }
        walk(node.operand);
        return;
      case "OrChain":
      case "EitherOr":
        errors.push(runtimeError("SES021", "Solve requires conjunctive constraints (no OR).", "or"));
        return;
      default:
        errors.push(runtimeError("SES021", "Solve constraint is unsupported.", node.kind ?? "EOF"));
    }
  }

  walk(condition);
  if (errors.length > 0) return { constraints: [], groundChecks: [], errors };

  const constraints = [];
  const groundChecks = [];

  for (const atom of atomic) {
    const vars = new Set();
    collectVariables(atom, vars);
    if (vars.size === 0) {
      groundChecks.push(atom);
      continue;
    }
    vars.forEach((name) => allVariables.add(name));
    const assertion = atom.assertion;
    const isNegated = Boolean(atom.negated);
    if (!assertion) {
      errors.push(runtimeError("SES021", "Solve constraint missing assertion.", "EOF"));
      continue;
    }

    if (assertion.kind === "CopulaPredicateAssertion") {
      const subjectVar = assertion.subject?.kind === "Variable" ? assertion.subject.name : null;
      if (!subjectVar) {
        errors.push(runtimeError("SES022", "Solve constraint requires variable subject.", "subject"));
        continue;
      }
      if (assertion.complement?.kind === "Variable") {
        errors.push(runtimeError("SES022", "Variable complement is not supported.", "complement"));
        continue;
      }
      const unaryId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
      const kbState = state.kb.kb;
      const unarySet = unaryId === null ? emptySet(kbState) : kbState.unaryIndex[unaryId];
      const filterSet = isNegated ? fullSet(kbState).andNot(unarySet ?? emptySet(kbState)) : unarySet ?? emptySet(kbState);
      constraints.push({
        kind: "unary",
        variable: subjectVar,
        unaryId,
        negated: isNegated,
        set: filterSet,
      });
      continue;
    }

    if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
      if (isNegated) {
        errors.push(runtimeError("SES021", "Solve does not support negated binary constraints.", "not"));
        continue;
      }
      const predId = resolvePredId(assertion, state);
      if (predId === null) {
        errors.push(runtimeError("SES022", "Unknown predicate in solve constraint.", "predicate"));
        continue;
      }
      const subjectVar = assertion.subject?.kind === "Variable" ? assertion.subject.name : null;
      const objectVar = assertion.object?.kind === "Variable" ? assertion.object.name : null;
      if (!subjectVar && !objectVar) {
        groundChecks.push(atom);
        continue;
      }
      if (subjectVar && assertion.subject.kind !== "Variable") {
        errors.push(runtimeError("SES022", "Unsupported subject in solve constraint.", "subject"));
        continue;
      }
      if (objectVar && assertion.object.kind !== "Variable") {
        errors.push(runtimeError("SES022", "Unsupported object in solve constraint.", "object"));
        continue;
      }
      const subjectSet = subjectVar ? null : resolveEntitySet(assertion.subject, state);
      const objectSet = objectVar ? null : resolveEntitySet(assertion.object, state);
      constraints.push({
        kind: "binary",
        predId,
        subjectVar,
        objectVar,
        subjectSet,
        objectSet,
      });
      continue;
    }

    if (assertion.kind === "AttributeAssertion") {
      if (isNegated) {
        errors.push(runtimeError("SES021", "Solve does not support negated attribute constraints.", "not"));
        continue;
      }
      const subjectVar = assertion.subject?.kind === "Variable" ? assertion.subject.name : null;
      if (!subjectVar) {
        errors.push(runtimeError("SES022", "Attribute constraint requires variable subject.", "subject"));
        continue;
      }
      if (!assertion.value || assertion.value.kind === "Variable") {
        errors.push(runtimeError("SES022", "Attribute value must be a literal or name.", "value"));
        continue;
      }
      const attrKey = canonicalAttributeKey(assertion.attribute);
      if (!attrKey) {
        errors.push(runtimeError("SES022", "Invalid attribute in solve constraint.", "attribute"));
        continue;
      }
      const conceptId = state.idStore.internConcept(ConceptKind.Attribute, attrKey);
      const attrId = state.idStore.getDenseId(ConceptKind.Attribute, conceptId);
      const kbState = state.kb.kb;
      if (assertion.value.kind === "NumberLiteral") {
        const index = kbState.numericIndex[attrId];
        const filtered = index ? index.filter("eq", assertion.value.value) : emptySet(kbState);
        constraints.push({ kind: "unary", variable: subjectVar, unaryId: null, set: filtered });
        continue;
      }
      const valueSet = resolveEntitySet(assertion.value, state);
      const index = kbState.entAttrIndex[attrId];
      const filtered = index ? index.filter(valueSet) : emptySet(kbState);
      constraints.push({ kind: "unary", variable: subjectVar, unaryId: null, set: filtered });
      continue;
    }

    if (assertion.kind === "ComparisonAssertion") {
      if (isNegated) {
        errors.push(runtimeError("SES021", "Solve does not support negated comparison constraints.", "not"));
        continue;
      }
      if (assertion.left?.kind === "AttributeRef") {
        const subjectVar = assertion.left.attribute?.kind === "Variable" ? assertion.left.attribute.name : null;
        if (subjectVar) {
          errors.push(runtimeError("SES022", "Comparison constraints with variables are not supported.", "comparison"));
          continue;
        }
      }
      errors.push(runtimeError("SES022", "Comparison constraints with variables are not supported.", "comparison"));
      continue;
    }

    errors.push(runtimeError("SES022", "Unsupported assertion in solve constraint.", assertion.kind));
  }

  return { constraints, groundChecks, errors };
}

