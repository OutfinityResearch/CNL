export function createJustificationStore() {
  const baseFacts = new Map();
  const derivedFacts = new Map();

  function makeFactId(predId, subjectId, objectId) {
    // Pack into BigInt: (predId << 32) | (subjectId << 16) | objectId
    // Using BigInt to avoid overflow issues
    const packed = (BigInt(predId) << 32n) | (BigInt(subjectId) << 16n) | BigInt(objectId);
    return packed;
  }

  function makeUnaryFactId(unaryId, subjectId) {
    // Pack unary facts with a different pattern: (1n << 63n) | (unaryId << 16n) | subjectId
    // High bit set to distinguish from binary facts
    const packed = (1n << 63n) | (BigInt(unaryId) << 16n) | BigInt(subjectId);
    return packed;
  }

  function makeNumericFactId(attrId, subjectId, value) {
    return `N:${attrId}:${subjectId}:${String(value)}`;
  }

  function makeEntityAttrFactId(attrId, subjectId, entityId) {
    return `EA:${attrId}:${subjectId}:${entityId}`;
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

  // Debug helper to unpack FactID
  function unpackFactId(factId) {
    if (typeof factId === "string") {
      if (factId.startsWith("N:")) {
        const parts = factId.split(":");
        if (parts.length >= 4) {
          return {
            type: "numeric",
            attrId: Number(parts[1]),
            subjectId: Number(parts[2]),
            value: Number(parts.slice(3).join(":")),
          };
        }
      }
      if (factId.startsWith("EA:")) {
        const parts = factId.split(":");
        if (parts.length === 4) {
          return {
            type: "entityAttr",
            attrId: Number(parts[1]),
            subjectId: Number(parts[2]),
            entityId: Number(parts[3]),
          };
        }
      }
      return null;
    }
    const id = BigInt(factId);
    if (id & (1n << 63n)) {
      // Unary fact
      const unaryId = Number((id >> 16n) & 0x7FFFFFFFn);
      const subjectId = Number(id & 0xFFFFn);
      return { type: "unary", unaryId, subjectId };
    } else {
      // Binary fact
      const predId = Number(id >> 32n);
      const subjectId = Number((id >> 16n) & 0xFFFFn);
      const objectId = Number(id & 0xFFFFn);
      return { type: "binary", predId, subjectId, objectId };
    }
  }

  return {
    makeFactId,
    makeUnaryFactId,
    makeNumericFactId,
    makeEntityAttrFactId,
    addBaseFact,
    addDerivedFact,
    getJustification,
    unpackFactId,
    baseFacts,
    derivedFacts,
  };
}
