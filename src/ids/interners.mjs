const KIND_SHIFT = 56n;
const MAX_INDEX = (1n << 56n) - 1n;

export const ConceptKind = Object.freeze({
  Entity: 1,
  Predicate: 2,
  UnaryPredicate: 3,
  Attribute: 4,
  Literal: 5,
  Rule: 6,
  Action: 7,
  Fact: 8,
  Proposition: 9,
  Comparator: 10,
});

function makeConceptualId(kind, index) {
  if (index > MAX_INDEX) {
    throw new RangeError(`ConceptualID index overflow for kind ${kind}`);
  }
  return (BigInt(kind) << KIND_SHIFT) | index;
}

export function createInterners() {
  const byKind = new Map();
  const counters = new Map();
  const keyByConcept = new Map();

  function getKindMap(kind) {
    if (!byKind.has(kind)) {
      byKind.set(kind, new Map());
      counters.set(kind, 0n);
    }
    return byKind.get(kind);
  }

  function intern(kind, key) {
    const map = getKindMap(kind);
    if (map.has(key)) {
      return map.get(key);
    }
    const index = counters.get(kind);
    const id = makeConceptualId(kind, index);
    map.set(key, id);
    keyByConcept.set(id, key);
    counters.set(kind, index + 1n);
    return id;
  }

  function lookupKey(conceptId) {
    return keyByConcept.get(conceptId);
  }

  return {
    intern,
    lookupKey,
  };
}

export function createDenseMaps() {
  const byKind = new Map();
  const reverse = new Map();

  function getMap(kind) {
    if (!byKind.has(kind)) {
      byKind.set(kind, new Map());
      reverse.set(kind, []);
    }
    return byKind.get(kind);
  }

  function getOrCreate(kind, conceptId) {
    const map = getMap(kind);
    if (map.has(conceptId)) {
      return map.get(conceptId);
    }
    const list = reverse.get(kind);
    const id = list.length;
    map.set(conceptId, id);
    list.push(conceptId);
    return id;
  }

  function getConcept(kind, denseId) {
    const list = reverse.get(kind) ?? [];
    return list[denseId];
  }

  function size(kind) {
    const list = reverse.get(kind) ?? [];
    return list.length;
  }

  return {
    getOrCreate,
    getConcept,
    size,
  };
}

export function createIdStore() {
  const interners = createInterners();
  const denseMaps = createDenseMaps();

  return {
    internConcept: interners.intern,
    getDenseId: denseMaps.getOrCreate,
    getConceptualId: denseMaps.getConcept,
    lookupKey: interners.lookupKey,
    size: denseMaps.size,
  };
}
