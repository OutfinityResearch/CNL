import { formatBinaryFact, formatUnaryFact } from "../facts.mjs";
import { pickSingletonEntityId } from "./search.mjs";

export function collectSolvePremises(solutions, constraints, state, limits = {}) {
  const store = state.justificationStore;
  if (!store) return [];
  const seen = new Set();
  const out = [];
  const maxSolutions = limits.maxPremiseSolutions ?? 10;

  function add(sentence) {
    if (!sentence) return;
    if (seen.has(sentence)) return;
    seen.add(sentence);
    out.push(sentence);
  }

  for (const sol of solutions.slice(0, maxSolutions)) {
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
      const subjectId = constraint.subjectVar ? sol[constraint.subjectVar] : pickSingletonEntityId(constraint.subjectSet);
      const objectId = constraint.objectVar ? sol[constraint.objectVar] : pickSingletonEntityId(constraint.objectSet);
      if (!Number.isInteger(subjectId) || !Number.isInteger(objectId)) continue;
      add(formatBinaryFact(constraint.predId, subjectId, objectId, state));
    }
  }

  return out;
}

