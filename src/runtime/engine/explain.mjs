import { resolveEntityId, resolvePredId, resolveUnaryId } from "./helpers.mjs";
import { formatFactId } from "./facts.mjs";

function collectBaseFactIds(factId, store, seen, out) {
  if (seen.has(factId)) return;
  seen.add(factId);
  const justification = store.getJustification(factId);
  if (!justification) return;
  if (justification.kind === "Base") {
    out.push(factId);
    return;
  }
  for (const premiseId of justification.premiseIds ?? []) {
    collectBaseFactIds(premiseId, store, seen, out);
  }
}

export function explainAssertion(assertion, state) {
  const store = state.justificationStore;
  if (!store) return { error: "No justification store available." };
  if (!assertion) return { error: "No assertion to explain." };

  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const unaryId = resolveUnaryId(assertion.complement, state);
    if (subjectId === null || unaryId === null) {
      return { error: "Explanation requires a ground unary assertion." };
    }
    const factId = store.makeUnaryFactId(unaryId, subjectId);
    const justification = store.getJustification(factId);
    if (!justification) return { error: "No justification found." };
    const baseFactIds = [];
    collectBaseFactIds(factId, store, new Set(), baseFactIds);
    const baseFacts = baseFactIds
      .map((id) => formatFactId(id, state, store))
      .filter((item) => item);
    return { kind: "ExplainResult", factId, justification, baseFacts };
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    const predId = resolvePredId(assertion, state);
    if (subjectId === null || objectId === null || predId === null) {
      return { error: "Explanation requires a ground binary assertion." };
    }
    const factId = store.makeFactId(predId, subjectId, objectId);
    const justification = store.getJustification(factId);
    if (!justification) return { error: "No justification found." };
    const baseFactIds = [];
    collectBaseFactIds(factId, store, new Set(), baseFactIds);
    const baseFacts = baseFactIds
      .map((id) => formatFactId(id, state, store))
      .filter((item) => item);
    return { kind: "ExplainResult", factId, justification, baseFacts };
  }

  return { error: "Explanation unsupported for this assertion type." };
}
