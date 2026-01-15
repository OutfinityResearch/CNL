import { ConceptKind } from "../../../ids/interners.mjs";
import { displayEntityKey } from "../../../utils/display-keys.mjs";
import { emptySet, entitySet } from "../helpers.mjs";
import { propagateDomains } from "./propagation.mjs";

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

export function pickSingletonEntityId(bitset) {
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

export function searchSolveSolutions(domains, constraints, state, variables, limits = {}) {
  const kbState = state.kb.kb;
  const steps = [];
  const solutions = [];
  const maxSolutions = limits.maxSolutions ?? 25;
  const maxTraceSteps = limits.maxTraceSteps ?? 250;

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
      const result = propagateDomains(nextDomains, constraints, kbState, limits);
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

  if (solutions.length === 0) {
    record("No solution found.");
  } else {
    const maxSummary = limits.maxSolutionSummary ?? 5;
    record(`Found ${solutions.length} solution(s).`);
    solutions.slice(0, maxSummary).forEach((sol, idx) => {
      const parts = variables.map((name) => `?${name}=${entityLabel(sol[name], state)}`);
      record(`Solution ${idx + 1}: ${parts.join(", ")}.`);
    });
  }

  return { solutions, steps };
}

