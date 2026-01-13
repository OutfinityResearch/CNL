import { createError } from "../../validator/errors.mjs";
import {
  PREPOSITIONS,
  RELATIVE_PRONOUNS,
  COPULAS,
  AUXILIARIES,
  KEYWORDS,
} from "./constants.mjs";
import {
  isDeterminerToken,
  isQuantifierToken,
  isStartOfNounPhrase,
  shouldTreatAsNameToken,
} from "./token-stream.mjs";
import { isComparatorStart, parseComparatorOrThrow } from "./comparators.mjs";

export function parseIdentifier(stream) {
  const token = stream.peek();
  if (token.type !== "word") {
    throw createError("SYN001", token.raw);
  }
  if (KEYWORDS.has(token.lower) && !shouldTreatAsNameToken(token, stream.peek(1))) {
    throw createError("LEX003", token.raw);
  }
  stream.consume();
  return token;
}

export function parseName(stream) {
  const token = parseIdentifier(stream);
  return { kind: "Name", value: token.raw, span: { start: token.start, end: token.end } };
}

export function parseVariable(stream) {
  const token = stream.peek();
  if (token.type !== "var") {
    throw createError("SYN001", token.raw);
  }
  stream.consume();
  return { kind: "Variable", name: token.value, span: { start: token.start, end: token.end } };
}

export function parseNumberLiteral(stream) {
  const token = stream.peek();
  if (token.type !== "number") {
    throw createError("SYN001", token.raw);
  }
  stream.consume();
  return { kind: "NumberLiteral", value: Number(token.value), span: { start: token.start, end: token.end } };
}

export function parseExpr(stream) {
  const token = stream.peek();
  if (!token || token.type === "EOF") {
    throw createError("SYN002", "EOF");
  }
  if (token.type === "number") {
    return parseNumberLiteral(stream);
  }
  if (token.type === "string") {
    const consumed = stream.consume();
    return { kind: "StringLiteral", value: consumed.value, span: { start: consumed.start, end: consumed.end } };
  }
  if (token.type === "var") {
    return parseVariable(stream);
  }
  if (token.type === "word") {
    if (token.lower === "true" || token.lower === "false") {
      const consumed = stream.consume();
      return {
        kind: "BooleanLiteral",
        value: consumed.lower === "true",
        span: { start: consumed.start, end: consumed.end },
      };
    }
    const agg = tryParseAggregation(stream);
    if (agg) return agg;
    if (isStartOfNounPhrase(token, stream.peek(1))) {
      return parseNounPhrase(stream);
    }
    return parseName(stream);
  }
  throw createError("SYN001", token.raw);
}

function tryParseAggregation(stream) {
  const start = stream.pos;
  const first = stream.peek();
  const second = stream.peek(1);
  if (!(first.type === "word" && first.lower === "the")) {
    return null;
  }
  if (second.type !== "word") return null;

  if (second.lower === "number" && stream.peek(2).lower === "of") {
    stream.pos += 3;
    const set = parseSetRef(stream);
    return { kind: "AggregationExpr", agg: "NumberOf", attribute: null, set };
  }

  if (second.lower === "total") {
    stream.pos += 2;
    const attribute = parseAttrSelector(stream, { stopOnOf: true, stopOnComparator: true });
    let set = null;
    if (stream.peek().type === "word" && stream.peek().lower === "of") {
      stream.consume();
      set = parseSetRef(stream);
    }
    return { kind: "AggregationExpr", agg: "TotalOf", attribute, set };
  }

  if (second.lower === "average" && stream.peek(2).lower === "of") {
    stream.pos += 3;
    const attribute = parseAttrSelector(stream, { stopOnOf: true, stopOnComparator: true });
    if (!(stream.peek().type === "word" && stream.peek().lower === "of")) {
      stream.pos = start;
      return null;
    }
    stream.consume();
    const set = parseSetRef(stream);
    return { kind: "AggregationExpr", agg: "AverageOf", attribute, set };
  }

  if (second.lower === "sum" && stream.peek(2).lower === "of") {
    stream.pos += 3;
    const attribute = parseAttrSelector(stream, { stopOnOf: true, stopOnComparator: true });
    if (!(stream.peek().type === "word" && stream.peek().lower === "of")) {
      stream.pos = start;
      return null;
    }
    stream.consume();
    const set = parseSetRef(stream);
    return { kind: "AggregationExpr", agg: "SumOf", attribute, set };
  }

  stream.pos = start;
  return null;
}

export function parseSetRef(stream) {
  const token = stream.peek();
  if (token.type === "var") {
    return parseVariable(stream);
  }
  if (isStartOfNounPhrase(token, stream.peek(1))) {
    return parseNounPhrase(stream);
  }
  if (token.type === "word") {
    return parseImplicitNounPhrase(stream);
  }
  return parseName(stream);
}

export function parseAttrSelector(stream, { stopOnOf, stopOnComparator } = {}) {
  const words = [];
  while (true) {
    const token = stream.peek();
    if (token.type !== "word") break;
    if (stopOnOf && token.lower === "of") break;
    if (stopOnComparator && isComparatorStart(token, stream.peek(1))) break;
    if (PREPOSITIONS.has(token.lower)) break;
    if (RELATIVE_PRONOUNS.has(token.lower)) break;
    if (COPULAS.has(token.lower)) break;
    if (token.lower === "and" || token.lower === "or" || token.lower === "if" || token.lower === "then") break;
    if (KEYWORDS.has(token.lower)) {
      throw createError("LEX003", token.raw);
    }
    words.push(token.raw);
    stream.consume();
  }
  if (words.length === 0) {
    throw createError("SYN001", stream.peek().raw);
  }
  return { kind: "AttrSelector", words };
}

export function parseNounPhrase(stream) {
  const startToken = stream.peek();
  const token = startToken;
  let prefix = null;

  if (token.lower === "at" && stream.peek(1).lower === "least") {
    stream.consume();
    stream.consume();
    const numberToken = stream.peek();
    if (numberToken.type !== "number") {
      throw createError("SYN017", numberToken.raw);
    }
    const n = Number(numberToken.value);
    stream.consume();
    prefix = { kind: "Quantifier", q: "at least", n };
  } else if (token.lower === "at" && stream.peek(1).lower === "most") {
    stream.consume();
    stream.consume();
    const numberToken = stream.peek();
    if (numberToken.type !== "number") {
      throw createError("SYN017", numberToken.raw);
    }
    const n = Number(numberToken.value);
    stream.consume();
    prefix = { kind: "Quantifier", q: "at most", n };
  } else if (isQuantifierToken(token)) {
    stream.consume();
    prefix = { kind: "Quantifier", q: token.lower, n: null };
  } else if (isDeterminerToken(token)) {
    stream.consume();
    prefix = { kind: "Determiner", value: token.lower };
  } else {
    throw createError("SYN009", token.raw);
  }

  const core = [];
  while (true) {
    const next = stream.peek();
    if (next.type === "string") {
      if (core.length > 0) {
        throw createError("SYN018", next.raw);
      }
      core.push(next.value);
      stream.consume();
      break;
    }
    if (next.type !== "word") break;
    if (PREPOSITIONS.has(next.lower)) break;
    if (RELATIVE_PRONOUNS.has(next.lower)) break;
    if (COPULAS.has(next.lower)) break;
    if (next.lower === "and" || next.lower === "or" || next.lower === "if" || next.lower === "then") break;
    if (next.lower === "because" || next.lower === "such") break;
    if (isComparatorStart(next, stream.peek(1))) break;
    if (core.length > 0 && shouldStopBeforeCoreWord(next, stream.peek(1), stream.peek(2))) break;
    if (core.length > 0) {
      throw createError("SYN018", next.raw);
    }
    if (KEYWORDS.has(next.lower)) {
      throw createError("LEX003", next.raw);
    }
    core.push(next.raw);
    stream.consume();
  }

  if (core.length === 0) {
    throw createError("SYN001", stream.peek().raw);
  }

  const pp = [];
  while (true) {
    const next = stream.peek();
    if (!(next.type === "word" && PREPOSITIONS.has(next.lower))) break;
    const preposition = next.lower;
    stream.consume();
    const object = parseObjectRef(stream);
    pp.push({ kind: "PrepositionalPhrase", preposition, object });
  }

  let relative = null;
  if (stream.peek().type === "word" && RELATIVE_PRONOUNS.has(stream.peek().lower)) {
    relative = parseRelativeRestriction(stream);
  }

  const endToken = stream.last ?? startToken;
  return { kind: "NounPhrase", prefix, core, pp, relative, span: { start: startToken.start, end: endToken.end } };
}

export function parseImplicitNounPhrase(stream) {
  const startToken = stream.peek();
  const core = [];
  while (true) {
    const next = stream.peek();
    if (next.type === "string") {
      if (core.length > 0) {
        throw createError("SYN018", next.raw);
      }
      core.push(next.value);
      stream.consume();
      break;
    }
    if (next.type !== "word") break;
    if (PREPOSITIONS.has(next.lower)) break;
    if (RELATIVE_PRONOUNS.has(next.lower)) break;
    if (COPULAS.has(next.lower)) break;
    if (next.lower === "and" || next.lower === "or" || next.lower === "if" || next.lower === "then") break;
    if (next.lower === "because" || next.lower === "such") break;
    if (isComparatorStart(next, stream.peek(1))) break;
    if (core.length > 0) {
      throw createError("SYN018", next.raw);
    }
    if (KEYWORDS.has(next.lower)) {
      throw createError("LEX003", next.raw);
    }
    core.push(next.raw);
    stream.consume();
  }

  if (core.length === 0) {
    throw createError("SYN001", stream.peek().raw);
  }

  const pp = [];
  while (true) {
    const next = stream.peek();
    if (!(next.type === "word" && PREPOSITIONS.has(next.lower))) break;
    const preposition = next.lower;
    stream.consume();
    const object = parseObjectRef(stream);
    pp.push({ kind: "PrepositionalPhrase", preposition, object });
  }

  let relative = null;
  if (stream.peek().type === "word" && RELATIVE_PRONOUNS.has(stream.peek().lower)) {
    relative = parseRelativeRestriction(stream);
  }

  const endToken = stream.last ?? startToken;
  return {
    kind: "NounPhrase",
    prefix: { kind: "Determiner", value: "the" },
    core,
    pp,
    relative,
    span: { start: startToken.start, end: endToken.end },
  };
}

function shouldStopBeforeCoreWord(nextToken, afterToken, afterNextToken) {
  if (!afterToken || afterToken.type === "EOF") return false;
  if (isStartOfNounPhrase(afterToken, afterNextToken)) return true;
  if (afterToken.type === "word" && !KEYWORDS.has(afterToken.lower) && !PREPOSITIONS.has(afterToken.lower)) {
    return true;
  }
  if (afterToken.type === "word" && ["with", "in", "to"].includes(afterToken.lower)) {
    return true;
  }
  return false;
}

export function parseObjectRef(stream) {
  const token = stream.peek();
  if (token.type === "string" || token.type === "number") {
    return parseExpr(stream);
  }
  if (token.type === "word" && (token.lower === "true" || token.lower === "false")) {
    return parseExpr(stream);
  }
  if (token.type === "var") {
    return parseVariable(stream);
  }
  if (isStartOfNounPhrase(token, stream.peek(1))) {
    return parseNounPhrase(stream);
  }
  return parseName(stream);
}

export function parseRelativeRestriction(stream) {
  const clauses = [];
  let operator = null;
  while (true) {
    const pronounToken = stream.peek();
    if (!(pronounToken.type === "word" && RELATIVE_PRONOUNS.has(pronounToken.lower))) {
      throw createError("SYN010", pronounToken.raw);
    }
    const clause = parseRelativeClause(stream);
    clauses.push(clause);

    const next = stream.peek();
    if (!(next.type === "word" && (next.lower === "and" || next.lower === "or"))) break;
    if (!operator) {
      operator = next.lower;
    } else if (operator !== next.lower) {
      throw createError("SYN012", next.raw);
    }
    stream.consume();
  }

  if (clauses.length === 1) {
    return clauses[0];
  }
  if (operator === "and") {
    return { kind: "RelativeAndChain", items: clauses };
  }
  return { kind: "RelativeOrChain", items: clauses };
}

export function parseRelativeClause(stream) {
  const pronoun = stream.consume().lower;

  if (pronoun === "where") {
    const left = parseExpr(stream);
    const comparator = parseComparatorOrThrow(stream);
    const right = parseExpr(stream);
    return { kind: "RelativeClause", pronoun, body: { kind: "RelComparison", left, comparator, right } };
  }

  if (pronoun === "whose") {
    const attribute = parseAttrSelector(stream, { stopOnOf: true, stopOnComparator: true });
    if (!COPULAS.has(stream.peek().lower)) {
      throw createError("SYN001", stream.peek().raw);
    }
    stream.consume();
    const comparator = parseComparatorOrThrow(stream, { allowCopula: false, allowBareContains: false });
    const right = parseExpr(stream);
    return {
      kind: "RelativeClause",
      pronoun,
      body: {
        kind: "RelAttributeLike",
        attribute: { kind: "AttrSelector", words: attribute.words },
        predicate: { kind: "RelPredicateComparison", comparator, right },
      },
    };
  }

  if (COPULAS.has(stream.peek().lower)) {
    const copula = stream.consume().lower;
    const next = stream.peek();
    if (next.type === "word" && PREPOSITIONS.has(stream.peek(1).lower)) {
      const verb = parseIdentifier(stream).raw;
      const preposition = stream.consume().lower;
      const object = parseObjectRef(stream);
      return { kind: "RelativeClause", pronoun, body: { kind: "RelPassiveRelation", copula, verb, preposition, object } };
    }

    const complement = isStartOfNounPhrase(next, stream.peek(1)) ? parseNounPhrase(stream) : parseName(stream);
    return { kind: "RelativeClause", pronoun, body: { kind: "RelCopulaPredicate", copula, complement } };
  }

  const verbGroup = parseVerbGroup(stream);
  const object = parseObjectRef(stream);
  return { kind: "RelativeClause", pronoun, body: { kind: "RelActiveRelation", verbGroup, object } };
}

export function parseVerbGroup(stream) {
  const startToken = stream.peek();
  let auxiliary = null;
  const first = stream.peek();
  if (first.type === "word" && AUXILIARIES.has(first.lower)) {
    auxiliary = first.lower;
    stream.consume();
  }
  const verb = parseIdentifier(stream).raw;
  const particles = [];
  while (stream.peek().type === "word" && PREPOSITIONS.has(stream.peek().lower)) {
    particles.push(stream.consume().lower);
  }
  const endToken = stream.last ?? startToken;
  return { kind: "VerbGroup", auxiliary, verb, particles, span: { start: startToken.start, end: endToken.end } };
}

export function parseAttributeRef(stream, { stopAtOfValue = false } = {}) {
  const startToken = stream.peek();
  const core = [];
  while (true) {
    const token = stream.peek();
    if (token.type !== "word") break;
    if (token.lower === "of") break;
    if (PREPOSITIONS.has(token.lower)) break;
    if (RELATIVE_PRONOUNS.has(token.lower)) break;
    if (COPULAS.has(token.lower)) break;
    if (KEYWORDS.has(token.lower)) {
      throw createError("LEX003", token.raw);
    }
    core.push(token.raw);
    stream.consume();
  }
  if (core.length === 0) {
    throw createError("SYN001", stream.peek().raw);
  }
  const pp = [];
  while (stream.peek().type === "word" && PREPOSITIONS.has(stream.peek().lower)) {
    const preposition = stream.peek().lower;
    if (stopAtOfValue && preposition === "of") break;
    stream.consume();
    const object = parseObjectRef(stream);
    pp.push({ kind: "PrepositionalPhrase", preposition, object });
  }
  const endToken = stream.last ?? startToken;
  return {
    kind: "AttributeRef",
    core,
    pp,
    span: { start: startToken.start, end: endToken.end },
  };
}
