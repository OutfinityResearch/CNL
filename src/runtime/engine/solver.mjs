import { executeSet } from "../../plans/execute.mjs";
import { compileNP } from "../../compiler/ast-to-plan.mjs";
import { canonicalAttributeKey } from "../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import {
  collectEntities,
  collectVariables,
  emptySet,
  entitySet,
  fullSet,
  resolveEntityId,
  resolvePredId,
  resolveUnaryId,
  runtimeError,
} from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";

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

function image(predId, subjectSet, kbState) {
  if (!Number.isInteger(predId) || predId < 0 || predId >= kbState.predicatesCount) {
    return emptySet(kbState);
  }
  let acc = emptySet(kbState);
  if (!subjectSet || subjectSet.isEmpty()) return acc;
  const relation = kbState.relations[predId];
  subjectSet.iterateSetBits((subjectId) => {
    const row = relation?.rows?.[subjectId];
    if (row) {
      acc = acc.or(row);
    }
  });
  return acc;
}

function preimage(predId, objectSet, kbState) {
  if (!Number.isInteger(predId) || predId < 0 || predId >= kbState.predicatesCount) {
    return emptySet(kbState);
  }
  let acc = emptySet(kbState);
  if (!objectSet || objectSet.isEmpty()) return acc;
  const relation = kbState.invRelations[predId];
  objectSet.iterateSetBits((objectId) => {
    const row = relation?.rows?.[objectId];
    if (row) {
      acc = acc.or(row);
    }
  });
  return acc;
}

function intersectDomain(domain, filter) {
  const next = domain.and(filter);
  return {
    next,
    changed: next.popcount() !== domain.popcount(),
  };
}

function buildSolveConstraints(condition, state, allVariables) {
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
          errors.push(runtimeError("SES021", "Solve does not support negated constraints.", "not"));
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
      const unaryId = resolveUnaryId(assertion.complement, state);
      const unarySet = unaryId === null ? emptySet(state.kb.kb) : state.kb.kb.unaryIndex[unaryId];
      constraints.push({ kind: "unary", variable: subjectVar, set: unarySet ?? emptySet(state.kb.kb) });
      continue;
    }

    if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
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
        constraints.push({ kind: "unary", variable: subjectVar, set: filtered });
        continue;
      }
      const valueSet = resolveEntitySet(assertion.value, state);
      const index = kbState.entAttrIndex[attrId];
      const filtered = index ? index.filter(valueSet) : emptySet(kbState);
      constraints.push({ kind: "unary", variable: subjectVar, set: filtered });
      continue;
    }

    if (assertion.kind === "ComparisonAssertion") {
      errors.push(runtimeError("SES022", "Comparison constraints with variables are not supported.", "comparison"));
      continue;
    }

    errors.push(runtimeError("SES022", "Unsupported assertion in solve constraint.", assertion.kind));
  }

  return { constraints, groundChecks, errors };
}

export function solveWithVariables(command, state) {
  const requested = [];
  if (Array.isArray(command.variables) && command.variables.length > 0) {
    command.variables.forEach((v) => requested.push(v.name));
  } else if (command.expr?.kind === "Variable") {
    requested.push(command.expr.name);
  }

  const constraintVars = new Set();
  collectVariables(command.constraint, constraintVars);
  if (constraintVars.size > 0 && requested.length === 0) {
    return { error: runtimeError("SES020", "Solve with variables requires a variable target.", "Solve") };
  }

  const allVariables = new Set(requested);
  const { constraints, groundChecks, errors } = buildSolveConstraints(command.constraint, state, allVariables);
  if (errors.length > 0) {
    return { error: errors[0] };
  }

  for (const check of groundChecks) {
    if (!evaluateCondition(check, state)) {
      return { kind: "SolveResult", entities: [], bindings: {} };
    }
  }

  const kbState = state.kb.kb;
  const domains = new Map();
  allVariables.forEach((name) => {
    domains.set(name, fullSet(kbState));
  });

  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(constraints.length * 4, 10);

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;
    for (const constraint of constraints) {
      if (constraint.kind === "unary") {
        const current = domains.get(constraint.variable) ?? emptySet(kbState);
        const { next, changed: didChange } = intersectDomain(current, constraint.set);
        if (didChange) {
          domains.set(constraint.variable, next);
          changed = true;
        }
        if (next.isEmpty()) {
          return { kind: "SolveResult", entities: [], bindings: {} };
        }
        continue;
      }

      if (constraint.kind === "binary") {
        const subjectSet = constraint.subjectVar ? domains.get(constraint.subjectVar) : constraint.subjectSet;
        const objectSet = constraint.objectVar ? domains.get(constraint.objectVar) : constraint.objectSet;
        if (constraint.subjectVar) {
          const allowed = preimage(constraint.predId, objectSet, kbState);
          const current = domains.get(constraint.subjectVar) ?? emptySet(kbState);
          const { next, changed: didChange } = intersectDomain(current, allowed);
          if (didChange) {
            domains.set(constraint.subjectVar, next);
            changed = true;
          }
          if (next.isEmpty()) {
            return { kind: "SolveResult", entities: [], bindings: {} };
          }
        }
        if (constraint.objectVar) {
          const allowed = image(constraint.predId, subjectSet, kbState);
          const current = domains.get(constraint.objectVar) ?? emptySet(kbState);
          const { next, changed: didChange } = intersectDomain(current, allowed);
          if (didChange) {
            domains.set(constraint.objectVar, next);
            changed = true;
          }
          if (next.isEmpty()) {
            return { kind: "SolveResult", entities: [], bindings: {} };
          }
        }
      }
    }
  }

  const bindings = {};
  const outputVars = requested.length > 0 ? requested : Array.from(allVariables);
  outputVars.forEach((name) => {
    bindings[`?${name}`] = collectEntities(domains.get(name) ?? emptySet(kbState), state);
  });

  if (requested.length === 1) {
    const only = bindings[`?${requested[0]}`] ?? [];
    return { kind: "SolveResult", entities: only, bindings };
  }
  return { kind: "SolveResult", entities: [], bindings };
}
