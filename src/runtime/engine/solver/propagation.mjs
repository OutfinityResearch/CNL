import { emptySet } from "../helpers.mjs";

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

export function propagateDomains(domains, constraints, kbState, limits = {}) {
  let changed = true;
  let iterations = 0;
  const factor = limits.maxPropagationIterationsFactor ?? 6;
  const minIterations = limits.minPropagationIterations ?? 12;
  const maxIterations = Math.max(constraints.length * factor, minIterations);

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

