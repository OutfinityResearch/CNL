import { ConceptKind } from "../../../src/ids/interners.mjs";
import { displayEntityKey } from "../../../src/utils/display-keys.mjs";

function lookupKey(idStore, kind, denseId) {
  const cid = idStore.getConceptualId(kind, denseId);
  if (cid === undefined) return `[${denseId}]`;
  return idStore.lookupKey(cid) || `[${denseId}]`;
}

function factToSentence(fact, session) {
  const idStore = session?.state?.idStore;
  if (!fact || !idStore) return null;
  if (fact.type === "unary") {
    const subjectKey = lookupKey(idStore, ConceptKind.Entity, fact.subjectId);
    const unaryKey = lookupKey(idStore, ConceptKind.UnaryPredicate, fact.unaryId);
    return `${displayEntityKey(subjectKey)} is a ${displayEntityKey(unaryKey)}`;
  }
  if (fact.type === "binary") {
    const subjectKey = lookupKey(idStore, ConceptKind.Entity, fact.subjectId);
    const objectKey = lookupKey(idStore, ConceptKind.Entity, fact.objectId);
    const predKey = lookupKey(idStore, ConceptKind.Predicate, fact.predId);
    return `${displayEntityKey(subjectKey)} ${displayEntityKey(predKey).split("|").join(" ")} ${displayEntityKey(objectKey)}`;
  }
  return null;
}

export function summarizeResult(result, session) {
  if (!result) return "";
  switch (result.kind) {
    case "QueryResult":
    case "SolveResult":
      return JSON.stringify((result.entities || []).map((entry) => displayEntityKey(entry.key)));
    case "ProofResult":
      return String(result.value);
    case "ExplainResult": {
      const store = session?.state?.justificationStore;
      const premiseIds = result?.justification?.premiseIds || [];
      const premises = store
        ? premiseIds.map((id) => factToSentence(store.unpackFactId(id), session)).filter(Boolean)
        : [];
      return premises.length > 0 ? `premises:${premises.length}` : (result.justification?.kind ?? "explain");
    }
    case "PlanResult":
      return result.status ?? "";
    case "SimulationResult":
      return `steps=${result.steps}`;
    case "OptimizeResult":
      return `${result.status}:${result.value}`;
    default:
      return "";
  }
}
