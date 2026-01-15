import { compareNumeric } from "../utils/comparators.mjs";

export function createNumericIndex(size, bitsetFactory) {
  let values = new Float64Array(size);
  const hasValue = bitsetFactory(size);

  function ensureSize(minSize) {
    if (minSize <= values.length) return;
    const next = Math.max(minSize, values.length * 2, 1);
    const expanded = new Float64Array(next);
    expanded.set(values);
    values = expanded;
    hasValue.resize(next);
  }

  function setValue(subjectId, value) {
    ensureSize(subjectId + 1);
    values[subjectId] = value;
    hasValue.setBit(subjectId);
  }

  function filter(comparator, value) {
    const result = bitsetFactory(values.length);
    hasValue.iterateSetBits((subjectId) => {
      if (compareNumeric(comparator, values[subjectId], value)) {
        result.setBit(subjectId);
      }
    });
    return result;
  }

  return {
    get values() {
      return values;
    },
    hasValue,
    setValue,
    filter,
    ensureSize,
  };
}
