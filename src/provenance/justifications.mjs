export function createJustificationStore() {
  const baseFacts = new Map();
  const derivedFacts = new Map();

  function makeFactId(predId, subjectId, objectId) {
    return `${predId}:${subjectId}:${objectId}`;
  }

  function addBaseFact(factId, sourceInfo) {
    baseFacts.set(factId, sourceInfo);
  }

  function addDerivedFact(factId, ruleId, premiseIds) {
    derivedFacts.set(factId, { ruleId, premiseIds });
  }

  function getJustification(factId) {
    if (derivedFacts.has(factId)) {
      return { kind: "Derived", ...derivedFacts.get(factId) };
    }
    if (baseFacts.has(factId)) {
      return { kind: "Base", source: baseFacts.get(factId) };
    }
    return null;
  }

  return {
    makeFactId,
    addBaseFact,
    addDerivedFact,
    getJustification,
  };
}
