import { executeSet } from "../../plans/execute.mjs";
import { compileNP } from "../../compiler/ast-to-plan.mjs";
import { canonicalAttributeKey } from "../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { formatBinaryFact, formatUnaryFact } from "./facts.mjs";
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

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function entityLabel(entityId, state) {
  const conceptId = state.idStore.getConceptualId(ConceptKind.Entity, entityId);
  const key = conceptId ? state.idStore.lookupKey(conceptId) : null;
  return displayEntityKey(key) || `Entity_${entityId}`;
}

function sortedEntityIds(bitset, state) {
  const ids = [];
  bitset.iterateSetBits((id) => ids.push(id));
  ids.sort((a, b) => entityLabel(a, state).localeCompare(entityLabel(b, state)));
  return ids;
}

function pickSingletonEntityId(bitset) {
  if (!bitset) return null;
  let found = null;
  bitset.iterateSetBits((id) => {
    if (found === null) found = id;
  });
  return found;
}

function cloneDomains(domains) {
  const next = new Map();
  domains.forEach((value, key) => next.set(key, value.clone()));
  return next;
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
      errors.push(runtimeError("SES022", "Comparison constraints with variables are not supported.", "comparison"));
      continue;
    }

    errors.push(runtimeError("SES022", "Unsupported assertion in solve constraint.", assertion.kind));
  }

  return { constraints, groundChecks, errors };
}

function propagateDomains(domains, constraints, kbState) {
  let changed = true;
  let iterations = 0;
  const maxIterations = Math.max(constraints.length * 6, 12);

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
          return { ok: false, contradiction: constraint.variable };
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
            return { ok: false, contradiction: constraint.subjectVar };
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
            return { ok: false, contradiction: constraint.objectVar };
          }
        }
      }
    }
  }

  return { ok: true, contradiction: null };
}

function chooseNextVariable(domains, variables) {
  let best = null;
  let bestSize = Infinity;
  for (const name of variables) {
    const domain = domains.get(name);
    const size = domain ? domain.popcount() : 0;
    if (size <= 1) continue;
    if (size < bestSize) {
      best = name;
      bestSize = size;
    } else if (size === bestSize && best && name.localeCompare(best) < 0) {
      best = name;
    }
  }
  return best;
}

function isFullyAssigned(domains, variables) {
  for (const name of variables) {
    const domain = domains.get(name);
    if (!domain || domain.isEmpty() || domain.popcount() !== 1) return false;
  }
  return true;
}

function materializeAssignment(domains, variables) {
  const assignment = {};
  for (const name of variables) {
    const domain = domains.get(name);
    const id = domain ? pickSingletonEntityId(domain) : null;
    if (!Number.isInteger(id)) return null;
    assignment[name] = id;
  }
  return assignment;
}

function collectSolvePremises(solutions, constraints, state) {
  const store = state.justificationStore;
  if (!store) return [];
  const seen = new Set();
  const out = [];

  function add(sentence) {
    if (!sentence) return;
    if (seen.has(sentence)) return;
    seen.add(sentence);
    out.push(sentence);
  }

  for (const sol of solutions) {
    for (const constraint of constraints) {
      if (constraint.kind === "unary") {
        if (constraint.negated) continue;
        if (!constraint.unaryId) continue;
        const subjectId = sol[constraint.variable];
        if (!Number.isInteger(subjectId)) continue;
        add(formatUnaryFact(constraint.unaryId, subjectId, state));
        continue;
      }
      if (constraint.kind !== "binary") continue;
      const subjectId = constraint.subjectVar
        ? sol[constraint.subjectVar]
        : pickSingletonEntityId(constraint.subjectSet);
      const objectId = constraint.objectVar ? sol[constraint.objectVar] : pickSingletonEntityId(constraint.objectSet);
      if (!Number.isInteger(subjectId) || !Number.isInteger(objectId)) continue;
      add(formatBinaryFact(constraint.predId, subjectId, objectId, state));
    }
  }

  return out;
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

  const initial = propagateDomains(domains, constraints, kbState);
  if (!initial.ok) {
    return {
      kind: "SolveResult",
      entities: [],
      bindings: {},
      proof: {
        kind: "ProofTrace",
        mode: "SolveSearch",
        conclusion: "constraint solving",
        answerSummary: "unsatisfied",
        steps: [`Contradiction: empty domain for ?${initial.contradiction}.`],
        premises: [],
      },
    };
  }

  const outputVars = requested.length > 0 ? requested : Array.from(allVariables);
  const variables = Array.from(allVariables).sort();
  const needsSearch = variables.length > 1;

  if (!needsSearch) {
    const bindings = {};
    outputVars.forEach((name) => {
      bindings[`?${name}`] = collectEntities(domains.get(name) ?? emptySet(kbState), state);
    });
    const onlyEntities = requested.length === 1 ? bindings[`?${requested[0]}`] ?? [] : [];
    return {
      kind: "SolveResult",
      entities: onlyEntities,
      bindings,
      proof: {
        kind: "ProofTrace",
        mode: "Witness",
        conclusion: "solution domain",
        answerSummary: `count=${onlyEntities.length}`,
        steps: [`Returned ${onlyEntities.length} result(s).`],
        premises: [],
      },
    };
  }

  const steps = [];
  const solutions = [];
  const maxSolutions = 25;
  const maxTraceSteps = 250;

  function record(line) {
    if (steps.length >= maxTraceSteps) return;
    steps.push(line);
  }

  function search(currentDomains, depth) {
    if (solutions.length >= maxSolutions) return;
    if (isFullyAssigned(currentDomains, variables)) {
      const assignment = materializeAssignment(currentDomains, variables);
      if (assignment) solutions.push(assignment);
      return;
    }

    const chosen = chooseNextVariable(currentDomains, variables);
    if (!chosen) {
      const assignment = materializeAssignment(currentDomains, variables);
      if (assignment) solutions.push(assignment);
      return;
    }

    const domain = currentDomains.get(chosen) ?? emptySet(kbState);
    const candidates = sortedEntityIds(domain, state);
    for (const entityId of candidates) {
      if (solutions.length >= maxSolutions) return;
      const label = entityLabel(entityId, state);
      record(`${"  ".repeat(depth)}Try ?${chosen} = ${label}.`);
      const nextDomains = cloneDomains(currentDomains);
      nextDomains.set(chosen, entitySet(entityId, kbState));
      const result = propagateDomains(nextDomains, constraints, kbState);
      if (!result.ok) {
        record(`${"  ".repeat(depth)}Backtrack: empty domain for ?${result.contradiction}.`);
        continue;
      }
      search(nextDomains, depth + 1);
    }
  }

  record(`Search variables: ${variables.map((v) => `?${v}`).join(", ")}.`);
  variables.forEach((name) => {
    const domain = domains.get(name) ?? emptySet(kbState);
    const items = sortedEntityIds(domain, state).slice(0, 8).map((id) => entityLabel(id, state));
    record(`Domain(?${name}) = {${items.join(", ")}${domain.popcount() > 8 ? ", ..." : ""}}.`);
  });
  search(domains, 0);

  const bindings = {};
  outputVars.forEach((name) => {
    bindings[`?${name}`] = [];
  });

  const bindingIds = new Map();
  outputVars.forEach((name) => bindingIds.set(name, new Set()));
  for (const sol of solutions) {
    for (const name of outputVars) {
      const id = sol[name];
      if (Number.isInteger(id)) bindingIds.get(name).add(id);
    }
  }

  outputVars.forEach((name) => {
    const set = emptySet(kbState);
    for (const id of bindingIds.get(name)) set.setBit(id);
    bindings[`?${name}`] = collectEntities(set, state);
  });

  if (solutions.length === 0) {
    record("No solution found.");
  } else {
    record(`Found ${solutions.length} solution(s).`);
    solutions.slice(0, 5).forEach((sol, idx) => {
      const parts = outputVars.map((name) => `?${name}=${entityLabel(sol[name], state)}`);
      record(`Solution ${idx + 1}: ${parts.join(", ")}.`);
    });
  }

  const onlyEntities = requested.length === 1 ? bindings[`?${requested[0]}`] ?? [] : [];
  const premises = collectSolvePremises(solutions.slice(0, 10), constraints, state);

  return {
    kind: "SolveResult",
    entities: onlyEntities,
    bindings,
    solutions: solutions.slice(0, 25),
    proof: {
      kind: "ProofTrace",
      mode: "SolveSearch",
      conclusion: "constraint solving",
      answerSummary: `solutions=${solutions.length}`,
      steps,
      premises,
    },
  };
}
