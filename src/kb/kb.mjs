import { createBitset } from "./bitset.mjs";
import { createNumericIndex } from "./numeric-index.mjs";
import { createEntityAttrIndex } from "./entity-attrs.mjs";

function createRelationMatrix(entityCount, bitsetFactory) {
  const rows = [];
  for (let i = 0; i < entityCount; i += 1) {
    rows.push(bitsetFactory(entityCount));
  }
  return { rows };
}

export function createKB(options = {}) {
  const bitsetFactory = options.bitsetFactory ?? createBitset;

  const kb = {
    entitiesCount: 0,
    predicatesCount: 0,
    unaryCount: 0,
    attributesCount: 0,
    relations: [],
    invRelations: [],
    unaryIndex: [],
    numericIndex: [],
    entAttrIndex: [],
    bitsetFactory,
  };

  function ensureEntityCapacity(minSize) {
    if (minSize <= kb.entitiesCount) return;
    const previous = kb.entitiesCount;
    const next = minSize;
    kb.entitiesCount = next;

    kb.relations.forEach((matrix) => {
      for (let i = previous; i < next; i += 1) {
        matrix.rows.push(bitsetFactory(next));
      }
      for (let i = 0; i < previous; i += 1) {
        matrix.rows[i].resize(next);
      }
    });

    kb.invRelations.forEach((matrix) => {
      for (let i = previous; i < next; i += 1) {
        matrix.rows.push(bitsetFactory(next));
      }
      for (let i = 0; i < previous; i += 1) {
        matrix.rows[i].resize(next);
      }
    });

    kb.unaryIndex.forEach((bitset) => bitset.resize(next));
    kb.numericIndex.forEach((index) => index.ensureSize(next));
    kb.entAttrIndex.forEach((index) => index.ensureSize(next));
  }

  function ensurePredicateCapacity(minSize) {
    if (minSize <= kb.predicatesCount) return;
    for (let i = kb.predicatesCount; i < minSize; i += 1) {
      kb.relations.push(createRelationMatrix(kb.entitiesCount, bitsetFactory));
      kb.invRelations.push(createRelationMatrix(kb.entitiesCount, bitsetFactory));
    }
    kb.predicatesCount = minSize;
  }

  function ensureUnaryCapacity(minSize) {
    if (minSize <= kb.unaryCount) return;
    for (let i = kb.unaryCount; i < minSize; i += 1) {
      kb.unaryIndex.push(bitsetFactory(kb.entitiesCount));
    }
    kb.unaryCount = minSize;
  }

  function ensureAttributeCapacity(minSize) {
    if (minSize <= kb.attributesCount) return;
    for (let i = kb.attributesCount; i < minSize; i += 1) {
      kb.numericIndex.push(createNumericIndex(kb.entitiesCount, bitsetFactory));
      kb.entAttrIndex.push(createEntityAttrIndex(kb.entitiesCount, bitsetFactory));
    }
    kb.attributesCount = minSize;
  }

  function insertBinary(subjectId, predId, objectId) {
    ensureEntityCapacity(Math.max(subjectId, objectId) + 1);
    ensurePredicateCapacity(predId + 1);
    const row = kb.relations[predId].rows[subjectId];
    const inverse = kb.invRelations[predId].rows[objectId];
    const wasSet = row.hasBit(objectId);
    if (!wasSet) {
      row.setBit(objectId);
      inverse.setBit(subjectId);
    }
    return !wasSet;
  }

  function insertUnary(unaryId, subjectId) {
    ensureEntityCapacity(subjectId + 1);
    ensureUnaryCapacity(unaryId + 1);
    const set = kb.unaryIndex[unaryId];
    const wasSet = set.hasBit(subjectId);
    if (!wasSet) {
      set.setBit(subjectId);
    }
    return !wasSet;
  }

  function setNumeric(attrId, subjectId, value) {
    ensureEntityCapacity(subjectId + 1);
    ensureAttributeCapacity(attrId + 1);
    kb.numericIndex[attrId].setValue(subjectId, value);
  }

  function insertEntityAttr(attrId, subjectId, entityId, options = {}) {
    ensureEntityCapacity(Math.max(subjectId, entityId) + 1);
    ensureAttributeCapacity(attrId + 1);
    kb.entAttrIndex[attrId].addValue(subjectId, entityId);
    if (Number.isInteger(options.projectPredId)) {
      insertBinary(subjectId, options.projectPredId, entityId);
    }
  }

  function hasBinary(subjectId, predId, objectId) {
    if (predId >= kb.predicatesCount) return false;
    if (subjectId >= kb.entitiesCount || objectId >= kb.entitiesCount) return false;
    return kb.relations[predId].rows[subjectId].hasBit(objectId);
  }

  return {
    kb,
    ensureEntityCapacity,
    ensurePredicateCapacity,
    ensureUnaryCapacity,
    ensureAttributeCapacity,
    insertBinary,
    insertUnary,
    setNumeric,
    insertEntityAttr,
    hasBinary,
  };
}
