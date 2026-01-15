export function createJustificationStore() {
  const baseFacts = new Map();
  const derivedFacts = new Map();

  const FACTID_KIND_UNARY = 1n << 127n;
  const MASK32 = (1n << 32n) - 1n;

  function assertU32(value, label) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
      throw new RangeError(`${label} out of range for FactID packing (u32): ${String(value)}`);
    }
    return n;
  }

  function makeFactId(predId, subjectId, objectId) {
    // 128-bit BigInt packing (u32/u32/u32 + kind bit).
    // Layout (low → high):
    // - bits [0..31]   : objectId
    // - bits [32..63]  : subjectId
    // - bits [64..95]  : predId
    // - bit  [127]     : kind=0 (binary)
    assertU32(predId, "predId");
    assertU32(subjectId, "subjectId");
    assertU32(objectId, "objectId");
    return (BigInt(predId) << 64n) | (BigInt(subjectId) << 32n) | BigInt(objectId);
  }

  function makeUnaryFactId(unaryId, subjectId) {
    // 128-bit BigInt packing (u32/u32 + kind bit).
    // Layout (low → high):
    // - bits [0..31]   : subjectId
    // - bits [32..63]  : unaryId
    // - bit  [127]     : kind=1 (unary)
    assertU32(unaryId, "unaryId");
    assertU32(subjectId, "subjectId");
    return FACTID_KIND_UNARY | (BigInt(unaryId) << 32n) | BigInt(subjectId);
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
    if (id & FACTID_KIND_UNARY) {
      // Unary fact
      const unaryId = Number((id >> 32n) & MASK32);
      const subjectId = Number(id & MASK32);
      return { type: "unary", unaryId, subjectId };
    } else {
      // Binary fact
      const predId = Number((id >> 64n) & MASK32);
      const subjectId = Number((id >> 32n) & MASK32);
      const objectId = Number(id & MASK32);
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
