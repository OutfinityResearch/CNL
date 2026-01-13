import { createError } from "../../validator/errors.mjs";
import { COPULAS } from "./constants.mjs";

export function isComparatorStart(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (token.lower === "contains" || token.lower === "does") return true;
  if (COPULAS.has(token.lower)) return true;
  if (token.lower === "greater" || token.lower === "less" || token.lower === "equal") return true;
  if (nextToken && nextToken.lower === "than") return true;
  return false;
}

export function parseComparatorOrNull(stream, { allowCopula = true, allowBareContains = true } = {}) {
  const token = stream.peek();
  if (!token || token.type !== "word") return null;

  if (allowBareContains && token.lower === "contains") {
    stream.consume();
    return { kind: "Comparator", op: "Contains" };
  }

  if (allowBareContains && token.lower === "does") {
    if (stream.peek(1).lower === "not" && stream.peek(2).lower === "contain") {
      stream.pos += 3;
      return { kind: "Comparator", op: "NotContains" };
    }
    throw createError("SYN005", token.raw);
  }

  if (!allowCopula && !COPULAS.has(token.lower)) {
    const seq = [
      token.lower,
      stream.peek(1).lower,
      stream.peek(2).lower,
      stream.peek(3).lower,
      stream.peek(4).lower,
    ];

    if (seq.slice(0, 5).join(" ") === "greater than or equal to") {
      stream.pos += 5;
      return { kind: "Comparator", op: "GreaterThanOrEqualTo" };
    }
    if (seq.slice(0, 5).join(" ") === "less than or equal to") {
      stream.pos += 5;
      return { kind: "Comparator", op: "LessThanOrEqualTo" };
    }
    if (seq.slice(0, 4).join(" ") === "not equal to") {
      stream.pos += 4;
      return { kind: "Comparator", op: "NotEqualTo" };
    }
    if (seq.slice(0, 2).join(" ") === "greater than") {
      stream.pos += 2;
      return { kind: "Comparator", op: "GreaterThan" };
    }
    if (seq.slice(0, 2).join(" ") === "less than") {
      stream.pos += 2;
      return { kind: "Comparator", op: "LessThan" };
    }
    if (seq.slice(0, 2).join(" ") === "equal to") {
      stream.pos += 2;
      return { kind: "Comparator", op: "EqualTo" };
    }

    return null;
  }

  if (!allowCopula || !COPULAS.has(token.lower)) {
    return null;
  }

  const lowerSeq = [
    token.lower,
    stream.peek(1).lower,
    stream.peek(2).lower,
    stream.peek(3).lower,
    stream.peek(4).lower,
    stream.peek(5).lower,
  ];

  if (
    lowerSeq.slice(0, 6).join(" ") === "is greater than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "are greater than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "was greater than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "were greater than or equal to"
  ) {
    stream.pos += 6;
    return { kind: "Comparator", op: "GreaterThanOrEqualTo" };
  }

  if (
    lowerSeq.slice(0, 6).join(" ") === "is less than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "are less than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "was less than or equal to" ||
    lowerSeq.slice(0, 6).join(" ") === "were less than or equal to"
  ) {
    stream.pos += 6;
    return { kind: "Comparator", op: "LessThanOrEqualTo" };
  }

  if (
    lowerSeq.slice(0, 4).join(" ") === "is not equal to" ||
    lowerSeq.slice(0, 4).join(" ") === "are not equal to" ||
    lowerSeq.slice(0, 4).join(" ") === "was not equal to" ||
    lowerSeq.slice(0, 4).join(" ") === "were not equal to"
  ) {
    stream.pos += 4;
    return { kind: "Comparator", op: "NotEqualTo" };
  }

  if (
    lowerSeq.slice(0, 3).join(" ") === "is equal to" ||
    lowerSeq.slice(0, 3).join(" ") === "are equal to" ||
    lowerSeq.slice(0, 3).join(" ") === "was equal to" ||
    lowerSeq.slice(0, 3).join(" ") === "were equal to"
  ) {
    stream.pos += 3;
    return { kind: "Comparator", op: "EqualTo" };
  }

  if (
    lowerSeq.slice(0, 3).join(" ") === "is greater than" ||
    lowerSeq.slice(0, 3).join(" ") === "are greater than" ||
    lowerSeq.slice(0, 3).join(" ") === "was greater than" ||
    lowerSeq.slice(0, 3).join(" ") === "were greater than"
  ) {
    stream.pos += 3;
    return { kind: "Comparator", op: "GreaterThan" };
  }

  if (
    lowerSeq.slice(0, 3).join(" ") === "is less than" ||
    lowerSeq.slice(0, 3).join(" ") === "are less than" ||
    lowerSeq.slice(0, 3).join(" ") === "was less than" ||
    lowerSeq.slice(0, 3).join(" ") === "were less than"
  ) {
    stream.pos += 3;
    return { kind: "Comparator", op: "LessThan" };
  }

  if (stream.peek(2).lower === "than") {
    const maybeBad = stream.peek(1);
    if (maybeBad.type === "word" && !["greater", "less"].includes(maybeBad.lower)) {
      throw createError("SYN005", maybeBad.raw);
    }
  }

  return null;
}

export function parseComparatorOrThrow(stream, { allowCopula = true, allowBareContains = true } = {}) {
  const comparator = parseComparatorOrNull(stream, { allowCopula, allowBareContains });
  if (!comparator) {
    throw createError("SYN005", stream.peek().raw);
  }
  return comparator;
}
