export function normalizeComparator(comparator) {
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
    case "!=":
    case "not equal to":
    case "notequalto":
      return "neq";
    default:
      return null;
  }
}

export function compareNumeric(comparator, left, right) {
  const normalized = normalizeComparator(comparator);
  if (!normalized) {
    throw new Error(`Unsupported comparator: ${comparator}`);
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

