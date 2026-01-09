export function createEntityAttrIndex(size, bitsetFactory) {
  const values = Array.from({ length: size }, () => bitsetFactory(size));

  function ensureSize(minSize) {
    const target = Math.max(minSize, values.length);
    if (target <= values.length) {
      values.forEach((bitset) => bitset.resize(target));
      return;
    }
    const next = Math.max(target, values.length * 2, 1);
    for (let i = values.length; i < next; i += 1) {
      values.push(bitsetFactory(next));
    }
    values.forEach((bitset) => bitset.resize(next));
  }

  function addValue(subjectId, entityId) {
    ensureSize(Math.max(subjectId + 1, entityId + 1));
    values[subjectId].setBit(entityId);
  }

  function filter(valueSet) {
    const result = bitsetFactory(values.length);
    for (let i = 0; i < values.length; i += 1) {
      if (values[i].intersects(valueSet)) {
        result.setBit(i);
      }
    }
    return result;
  }

  return {
    values,
    ensureSize,
    addValue,
    filter,
  };
}
