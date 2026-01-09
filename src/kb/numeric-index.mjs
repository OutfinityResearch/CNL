function normalizeComparator(comparator) {
  if (!comparator) return null;
  const rawValue = comparator && typeof comparator === "object" && comparator.op ? comparator.op : comparator;
  const raw = String(rawValue).toLowerCase().trim();
  switch (raw) {
    case "gt":
    case ">":
    case "greater than":
    case "greaterthan":
      return "gt";
    case "gte":
    case ">=":
    case "greater than or equal to":
    case "greaterthanorequalto":
    case "at least":
      return "gte";
    case "lt":
    case "<":
    case "less than":
    case "lessthan":
      return "lt";
    case "lte":
    case "<=":
    case "less than or equal to":
    case "lessthanorequalto":
    case "at most":
      return "lte";
    case "eq":
    case "=":
    case "equal to":
    case "equalto":
      return "eq";
    case "neq":
    case "!=" :
    case "not equal to":
    case "notequalto":
      return "neq";
    default:
      return null;
  }
}

function compareNumeric(op, left, right) {
  const normalized = normalizeComparator(op);
  if (!normalized) {
    throw new Error(`Unsupported comparator: ${op}`);
  }
  switch (normalized) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    default:
      return false;
  }
}

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
