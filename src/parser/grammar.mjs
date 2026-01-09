import { tokenize } from "../lexer/tokenizer.mjs";
import { createError } from "../validator/errors.mjs";

const PREPOSITIONS = new Set([
  "of",
  "to",
  "at",
  "in",
  "on",
  "with",
  "for",
  "from",
  "into",
  "between",
  "among",
  "over",
  "under",
]);

const RELATIVE_PRONOUNS = new Set(["who", "that", "which", "whose", "where"]);
const DETERMINERS = new Set(["a", "an", "the", "another"]);
const QUANTIFIERS = new Set(["every", "all", "no", "some"]);
const COPULAS = new Set(["is", "are", "was", "were"]);
const AUXILIARIES = new Set(["has", "have", "had"]);

const KEYWORDS = new Set([
  "if",
  "then",
  "and",
  "or",
  "not",
  "because",
  "both",
  "either",
  "neither",
  "nor",
  "it",
  "is",
  "the",
  "case",
  "that",
  "who",
  "which",
  "whose",
  "where",
  "every",
  "all",
  "no",
  "some",
  "at",
  "least",
  "most",
  "a",
  "an",
  "another",
  "has",
  "have",
  "had",
  "contains",
  "does",
  "contain",
  "return",
  "verify",
  "plan",
  "achieve",
  "find",
  "solve",
  "such",
  "simulate",
  "steps",
  "maximize",
  "minimize",
  "explain",
  "why",
  "rule",
  "command",
  "action",
  "agent",
  "precondition",
  "effect",
  "intent",
  "when",
  "occurs",
  "context",
  "greater",
  "less",
  "equal",
  "than",
  "total",
  "number",
  "average",
  "sum",
  "true",
  "false",
]);

class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] ?? {
      type: "EOF",
      value: "EOF",
      raw: "EOF",
      lower: "EOF",
    };
  }

  consume() {
    const token = this.peek();
    this.pos += 1;
    return token;
  }

  matchWord(value) {
    const token = this.peek();
    if (token.type === "word" && token.lower === value) {
      this.pos += 1;
      return token;
    }
    return null;
  }

  matchPunct(value) {
    const token = this.peek();
    if (token.type === "punct" && token.value === value) {
      this.pos += 1;
      return token;
    }
    return null;
  }

  done() {
    return this.pos >= this.tokens.length;
  }
}

function stripInlineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function isActionLabelLine(line) {
  return /^(action|agent|precondition|effect|intent)\s*:/i.test(line.trim());
}

function ensureBalancedParentheses(tokens) {
  let depth = 0;
  for (const token of tokens) {
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") {
      depth -= 1;
      if (depth < 0) {
        throw createError("SYN004", token.raw);
      }
    }
  }
  if (depth !== 0) {
    throw createError("SYN004", "EOF");
  }
}

function isDeterminerToken(token) {
  return token.type === "word" && DETERMINERS.has(token.lower);
}

function isQuantifierToken(token) {
  return token.type === "word" && QUANTIFIERS.has(token.lower);
}

function isStartOfNounPhrase(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (shouldTreatAsNameToken(token, nextToken)) return false;
  if (isDeterminerToken(token) || isQuantifierToken(token)) return true;
  if (token.lower === "at" && nextToken && (nextToken.lower === "least" || nextToken.lower === "most")) {
    return true;
  }
  return false;
}

function shouldTreatAsNameToken(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (token.raw === "A" && token.lower === "a") {
    if (!nextToken) return true;
    if (nextToken.type === "word" && PREPOSITIONS.has(nextToken.lower)) return true;
    if (nextToken.type === "punct" && nextToken.value !== "(") return true;
  }
  return false;
}

function parseIdentifier(stream) {
  const token = stream.peek();
  if (token.type !== "word") {
    throw createError("SYN001", token.raw);
  }
  if (KEYWORDS.has(token.lower) && !shouldTreatAsNameToken(token, stream.peek(1))) {
    throw createError("LEX003", token.raw);
  }
  stream.consume();
  return token.raw;
}

function parseName(stream) {
  const value = parseIdentifier(stream);
  return { kind: "Name", value };
}

function parseNumberLiteral(stream) {
  const token = stream.peek();
  if (token.type !== "number") {
    throw createError("SYN001", token.raw);
  }
  stream.consume();
  return { kind: "NumberLiteral", value: Number(token.value) };
}

function parseExpr(stream) {
  const token = stream.peek();
  if (!token || token.type === "EOF") {
    throw createError("SYN002", "EOF");
  }
  if (token.type === "number") {
    return parseNumberLiteral(stream);
  }
  if (token.type === "string") {
    stream.consume();
    return { kind: "StringLiteral", value: token.value };
  }
  if (token.type === "word") {
    if (token.lower === "true" || token.lower === "false") {
      stream.consume();
      return { kind: "BooleanLiteral", value: token.lower === "true" };
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

function parseSetRef(stream) {
  const token = stream.peek();
  if (isStartOfNounPhrase(token, stream.peek(1))) {
    return parseNounPhrase(stream);
  }
  if (token.type === "word") {
    return parseImplicitNounPhrase(stream);
  }
  return parseName(stream);
}

function parseAttrSelector(stream, { stopOnOf, stopOnComparator } = {}) {
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

function parseNounPhrase(stream) {
  const token = stream.peek();
  let prefix = null;

  if (token.lower === "at" && stream.peek(1).lower === "least") {
    stream.pos += 2;
    const numberToken = stream.peek();
    if (numberToken.type !== "number") {
      throw createError("SYN017", numberToken.raw);
    }
    const n = Number(numberToken.value);
    stream.consume();
    prefix = { kind: "Quantifier", q: "at least", n };
  } else if (token.lower === "at" && stream.peek(1).lower === "most") {
    stream.pos += 2;
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
    if (next.type !== "word") break;
    if (PREPOSITIONS.has(next.lower)) break;
    if (RELATIVE_PRONOUNS.has(next.lower)) break;
    if (COPULAS.has(next.lower)) break;
    if (next.lower === "and" || next.lower === "or" || next.lower === "if" || next.lower === "then") break;
    if (next.lower === "because" || next.lower === "such") break;
    if (isComparatorStart(next, stream.peek(1))) break;
    if (core.length > 0 && shouldStopBeforeCoreWord(next, stream.peek(1), stream.peek(2))) break;
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

  return { kind: "NounPhrase", prefix, core, pp, relative };
}

function parseImplicitNounPhrase(stream) {
  const core = [];
  while (true) {
    const next = stream.peek();
    if (next.type !== "word") break;
    if (PREPOSITIONS.has(next.lower)) break;
    if (RELATIVE_PRONOUNS.has(next.lower)) break;
    if (COPULAS.has(next.lower)) break;
    if (next.lower === "and" || next.lower === "or" || next.lower === "if" || next.lower === "then") break;
    if (next.lower === "because" || next.lower === "such") break;
    if (isComparatorStart(next, stream.peek(1))) break;
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

  return {
    kind: "NounPhrase",
    prefix: { kind: "Determiner", value: "the" },
    core,
    pp,
    relative,
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

function parseObjectRef(stream) {
  const token = stream.peek();
  if (token.type === "string" || token.type === "number") {
    return parseExpr(stream);
  }
  if (token.type === "word" && (token.lower === "true" || token.lower === "false")) {
    return parseExpr(stream);
  }
  if (isStartOfNounPhrase(token, stream.peek(1))) {
    return parseNounPhrase(stream);
  }
  return parseName(stream);
}

function parseRelativeRestriction(stream) {
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

function parseRelativeClause(stream) {
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
      const verb = parseIdentifier(stream);
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

function parseVerbGroup(stream) {
  let auxiliary = null;
  const first = stream.peek();
  if (first.type === "word" && AUXILIARIES.has(first.lower)) {
    auxiliary = first.lower;
    stream.consume();
  }
  const verb = parseIdentifier(stream);
  const particles = [];
  while (stream.peek().type === "word" && PREPOSITIONS.has(stream.peek().lower)) {
    particles.push(stream.consume().lower);
  }
  return { kind: "VerbGroup", auxiliary, verb, particles };
}

function parseComparatorOrThrow(stream, { allowCopula = true, allowBareContains = true } = {}) {
  const comparator = parseComparatorOrNull(stream, { allowCopula, allowBareContains });
  if (!comparator) {
    throw createError("SYN005", stream.peek().raw);
  }
  return comparator;
}

function isComparatorStart(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (token.lower === "contains" || token.lower === "does") return true;
  if (COPULAS.has(token.lower)) return true;
  if (token.lower === "greater" || token.lower === "less" || token.lower === "equal") return true;
  if (nextToken && nextToken.lower === "than") return true;
  return false;
}

function parseComparatorOrNull(stream, { allowCopula = true, allowBareContains = true } = {}) {
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

  if (lowerSeq.slice(0, 6).join(" ") === "is greater than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "are greater than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "was greater than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "were greater than or equal to") {
    stream.pos += 6;
    return { kind: "Comparator", op: "GreaterThanOrEqualTo" };
  }

  if (lowerSeq.slice(0, 6).join(" ") === "is less than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "are less than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "was less than or equal to" ||
      lowerSeq.slice(0, 6).join(" ") === "were less than or equal to") {
    stream.pos += 6;
    return { kind: "Comparator", op: "LessThanOrEqualTo" };
  }

  if (lowerSeq.slice(0, 4).join(" ") === "is not equal to" ||
      lowerSeq.slice(0, 4).join(" ") === "are not equal to" ||
      lowerSeq.slice(0, 4).join(" ") === "was not equal to" ||
      lowerSeq.slice(0, 4).join(" ") === "were not equal to") {
    stream.pos += 4;
    return { kind: "Comparator", op: "NotEqualTo" };
  }

  if (lowerSeq.slice(0, 3).join(" ") === "is equal to" ||
      lowerSeq.slice(0, 3).join(" ") === "are equal to" ||
      lowerSeq.slice(0, 3).join(" ") === "was equal to" ||
      lowerSeq.slice(0, 3).join(" ") === "were equal to") {
    stream.pos += 3;
    return { kind: "Comparator", op: "EqualTo" };
  }

  if (lowerSeq.slice(0, 3).join(" ") === "is greater than" ||
      lowerSeq.slice(0, 3).join(" ") === "are greater than" ||
      lowerSeq.slice(0, 3).join(" ") === "was greater than" ||
      lowerSeq.slice(0, 3).join(" ") === "were greater than") {
    stream.pos += 3;
    return { kind: "Comparator", op: "GreaterThan" };
  }

  if (lowerSeq.slice(0, 3).join(" ") === "is less than" ||
      lowerSeq.slice(0, 3).join(" ") === "are less than" ||
      lowerSeq.slice(0, 3).join(" ") === "was less than" ||
      lowerSeq.slice(0, 3).join(" ") === "were less than") {
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

function parseAssertionFromTokens(tokens) {
  const stream = new TokenStream(tokens);
  const left = parseExpr(stream);

  const comparator = parseComparatorOrNull(stream);
  if (comparator) {
    const right = parseExpr(stream);
    if (!stream.done()) {
      throw createError("SYN001", stream.peek().raw);
    }
    return { kind: "ComparisonAssertion", left, comparator, right };
  }

  const subject = left;
  const next = stream.peek();

  if (subject && subject.kind === "Name" && next.type === "word" && RELATIVE_PRONOUNS.has(next.lower)) {
    throw createError("SYN009", subject.value);
  }

  if (next.type === "word" && next.lower === "has") {
    if (isDeterminerToken(stream.peek(1))) {
      stream.consume();
      const determiner = stream.consume().lower;
      const attribute = parseAttributeRef(stream, { stopAtOfValue: true });
      let value = null;
      if (stream.peek().type === "word" && stream.peek().lower === "of") {
        stream.consume();
        value = parseExpr(stream);
      }
      if (!stream.done()) {
        throw createError("SYN001", stream.peek().raw);
      }
      return { kind: "AttributeAssertion", subject, determiner, attribute, value };
    }
    const remainder = stream.tokens.slice(stream.pos + 1);
    if (remainder.some((token) => token.type === "word" && token.lower === "of")) {
      throw createError("SYN008", stream.peek(1).raw);
    }
  }

  if (next.type === "word" && COPULAS.has(next.lower)) {
    const copula = stream.consume().lower;
    if (stream.peek().type === "word" && PREPOSITIONS.has(stream.peek(1).lower)) {
      const verb = parseIdentifier(stream);
      const preposition = stream.consume().lower;
      const object = parseObjectRef(stream);
      if (!stream.done()) {
        throw createError("SYN001", stream.peek().raw);
      }
      return { kind: "PassiveRelationAssertion", subject, copula, verb, preposition, object };
    }

    let complement = null;
    const nextToken = stream.peek();
    if (nextToken.type === "string" || nextToken.type === "number") {
      complement = parseExpr(stream);
    } else if (nextToken.type === "word" && (nextToken.lower === "true" || nextToken.lower === "false")) {
      complement = parseExpr(stream);
    } else {
      complement = isStartOfNounPhrase(nextToken, stream.peek(1)) ? parseNounPhrase(stream) : parseName(stream);
    }
    if (!stream.done()) {
      throw createError("SYN001", stream.peek().raw);
    }
    return { kind: "CopulaPredicateAssertion", subject, copula, complement };
  }

  const verbGroup = parseVerbGroup(stream);
  const object = parseObjectRef(stream);
  if (!stream.done()) {
    throw createError("SYN001", stream.peek().raw);
  }
  return { kind: "ActiveRelationAssertion", subject, verbGroup, object };
}

function parseAttributeRef(stream, { stopAtOfValue = false } = {}) {
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
  return { kind: "AttributeRef", core, pp };
}

function stripCommas(tokens) {
  return tokens.filter((token) => !(token.type === "punct" && token.value === ","));
}

function isComparatorOrToken(tokens, index) {
  const prev = tokens[index - 1];
  const next = tokens[index + 1];
  const next2 = tokens[index + 2];
  return (
    prev?.type === "word" &&
    prev.lower === "than" &&
    next?.type === "word" &&
    next.lower === "equal" &&
    next2?.type === "word" &&
    next2.lower === "to"
  );
}

function splitOnKeyword(tokens, keyword) {
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && token.type === "word" && token.lower === keyword) {
      if (keyword === "or" && isComparatorOrToken(tokens, i)) continue;
      return { left: tokens.slice(0, i), right: tokens.slice(i + 1), index: i };
    }
  }
  return null;
}

function splitByOperator(tokens, operator) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && token.type === "word" && token.lower === operator) {
      if (operator === "or" && isComparatorOrToken(tokens, i)) continue;
      parts.push(tokens.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(tokens.slice(start));
  return parts;
}

function tokensAreWrapped(tokens) {
  if (tokens.length < 2) return false;
  if (!(tokens[0].type === "punct" && tokens[0].value === "(")) return false;
  if (!(tokens[tokens.length - 1].type === "punct" && tokens[tokens.length - 1].value === ")")) return false;
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && i < tokens.length - 1) return false;
  }
  return depth === 0;
}

function parseConditionTokens(tokens) {
  const filtered = stripCommas(tokens);
  ensureBalancedParentheses(filtered);

  if (tokensAreWrapped(filtered)) {
    const inner = filtered.slice(1, -1);
    return { kind: "GroupCondition", inner: parseConditionTokens(inner) };
  }

  if (
    filtered.length >= 7 &&
    filtered[0].lower === "it" &&
    filtered[1].lower === "is" &&
    filtered[2].lower === "not" &&
    filtered[3].lower === "the" &&
    filtered[4].lower === "case" &&
    filtered[5].lower === "that"
  ) {
    const rest = filtered.slice(6);
    return { kind: "CaseScope", mode: "negative", operand: parseConditionTokens(rest) };
  }

  if (
    filtered.length >= 6 &&
    filtered[0].lower === "it" &&
    filtered[1].lower === "is" &&
    filtered[2].lower === "the" &&
    filtered[3].lower === "case" &&
    filtered[4].lower === "that"
  ) {
    const rest = filtered.slice(5);
    return { kind: "CaseScope", mode: "positive", operand: parseConditionTokens(rest) };
  }

  if (filtered[0].lower === "either") {
    const split = splitOnKeyword(filtered.slice(1), "or");
    if (!split) {
      throw createError("SYN001", filtered[0].raw);
    }
    return {
      kind: "EitherOr",
      left: parseConditionTokens(split.left),
      right: parseConditionTokens(split.right),
    };
  }

  if (filtered[0].lower === "both") {
    const split = splitOnKeyword(filtered.slice(1), "and");
    if (!split) {
      throw createError("SYN001", filtered[0].raw);
    }
    return {
      kind: "BothAnd",
      left: parseConditionTokens(split.left),
      right: parseConditionTokens(split.right),
    };
  }

  let hasAnd = false;
  let hasOr = false;
  let offendingToken = null;
  let seen = null;
  let depth = 0;
  for (let i = 0; i < filtered.length; i += 1) {
    const token = filtered[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth !== 0) continue;
    if (token.type === "word" && token.lower === "and") {
      hasAnd = true;
      if (!seen) seen = "and";
      if (seen !== "and" && !offendingToken) offendingToken = token;
    }
    if (token.type === "word" && token.lower === "or") {
      if (isComparatorOrToken(filtered, i)) continue;
      hasOr = true;
      if (!seen) seen = "or";
      if (seen !== "or" && !offendingToken) offendingToken = token;
    }
  }

  if (hasAnd && hasOr) {
    throw createError("SYN011", offendingToken ? offendingToken.raw : "or");
  }

  if (hasAnd) {
    const parts = splitByOperator(filtered, "and");
    return {
      kind: "AndChain",
      items: parts.map((part) => ({
        kind: "AtomicCondition",
        assertion: parseAssertionFromTokens(part),
      })),
    };
  }

  if (hasOr) {
    const parts = splitByOperator(filtered, "or");
    return {
      kind: "OrChain",
      items: parts.map((part) => ({
        kind: "AtomicCondition",
        assertion: parseAssertionFromTokens(part),
      })),
    };
  }

  return { kind: "AtomicCondition", assertion: parseAssertionFromTokens(filtered) };
}

function parseConditionalPrefix(tokens) {
  const filtered = stripCommas(tokens);
  ensureBalancedParentheses(filtered);
  if (!(filtered[0].type === "word" && filtered[0].lower === "if")) {
    throw createError("SYN001", filtered[0].raw);
  }

  let depth = 0;
  let thenIndex = -1;
  let commaIndex = -1;
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && token.type === "word" && token.lower === "then") {
      thenIndex = i;
      break;
    }
    if (depth === 0 && token.type === "punct" && token.value === "," && commaIndex === -1) {
      commaIndex = i;
    }
  }

  let conditionTokens = [];
  let thenTokens = [];
  if (thenIndex !== -1) {
    conditionTokens = tokens.slice(1, thenIndex);
    thenTokens = tokens.slice(thenIndex + 1);
  } else if (commaIndex !== -1) {
    conditionTokens = tokens.slice(1, commaIndex);
    thenTokens = tokens.slice(commaIndex + 1);
  } else {
    throw createError("SYN001", tokens[tokens.length - 1].raw);
  }

  const condition = parseConditionTokens(conditionTokens);
  const thenSentence = parseSentenceFromTokens(stripCommas(thenTokens));
  return { kind: "ConditionalSentence", condition, then: thenSentence };
}

function parseConditionalPostfix(tokens, ifSplit) {
  const conditionTokens = tokens.slice(ifSplit.index + 1);
  const thenTokens = tokens.slice(0, ifSplit.index);
  const condition = parseConditionTokens(conditionTokens);
  const thenSentence = parseSentenceFromTokens(stripCommas(thenTokens));
  return { kind: "ConditionalSentence", condition, then: thenSentence };
}

function parseSentenceFromTokens(tokens) {
  if (tokens.length === 0) {
    throw createError("SYN002", "EOF");
  }

  if (tokens[0].type === "word" && tokens[0].lower === "if") {
    return parseConditionalPrefix(tokens);
  }

  const becauseSplit = splitOnKeyword(tokens, "because");
  if (becauseSplit) {
    const assertion = parseAssertionFromTokens(stripCommas(becauseSplit.left));
    const because = parseConditionTokens(becauseSplit.right);
    return { kind: "BecauseSentence", assertion, because };
  }

  const ifSplit = splitOnKeyword(tokens, "if");
  if (ifSplit) {
    return parseConditionalPostfix(tokens, ifSplit);
  }

  const assertion = parseAssertionFromTokens(stripCommas(tokens));
  return { kind: "AssertionSentence", assertion };
}

function parseCommandFromTokens(tokens) {
  const stream = new TokenStream(tokens);
  const first = stream.peek();
  if (!(first.type === "word")) {
    throw createError("SYN001", first.raw);
  }

  if (first.lower === "return") {
    stream.consume();
    const expr = parseExpr(stream);
    if (!stream.done()) throw createError("SYN001", stream.peek().raw);
    return { kind: "ReturnCommand", expr };
  }

  if (first.lower === "verify") {
    stream.consume();
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const proposition = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind: "VerifyCommand", proposition };
  }

  if (first.lower === "find") {
    stream.consume();
    const expr = parseExpr(stream);
    if (!stream.matchWord("such")) {
      throw createError("SYN006", stream.peek().raw);
    }
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const constraint = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind: "FindCommand", expr, constraint };
  }

  if (first.lower === "solve") {
    stream.consume();
    if (!stream.matchWord("for")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const expr = parseExpr(stream);
    if (stream.done()) {
      return { kind: "SolveCommand", expr, constraint: null };
    }
    if (!stream.matchWord("such")) {
      throw createError("SYN006", stream.peek().raw);
    }
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const constraint = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind: "SolveCommand", expr, constraint };
  }

  if (first.lower === "simulate") {
    stream.consume();
    const numberToken = stream.peek();
    if (numberToken.type !== "number") {
      throw createError("SYN006", numberToken.raw, {
        hint: "Use the required form, such as 'simulate 10 steps'.",
      });
    }
    const steps = Number(numberToken.value);
    stream.consume();
    if (!stream.matchWord("steps")) {
      throw createError("SYN006", stream.peek().raw, {
        hint: "Use the required form, such as 'simulate 10 steps'.",
      });
    }
    return { kind: "SimulateCommand", steps };
  }

  if (first.lower === "maximize" || first.lower === "minimize") {
    const kind = first.lower === "maximize" ? "MaximizeCommand" : "MinimizeCommand";
    stream.consume();
    const objective = parseExpr(stream);
    if (!stream.matchWord("such")) {
      throw createError("SYN006", stream.peek().raw);
    }
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const constraint = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind, objective, constraint };
  }

  if (first.lower === "explain") {
    stream.consume();
    if (!stream.matchWord("why")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const proposition = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind: "ExplainCommand", proposition };
  }

  if (first.lower === "plan") {
    stream.consume();
    if (!stream.matchWord("to") || !stream.matchWord("achieve")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const condition = parseConditionTokens(stream.tokens.slice(stream.pos));
    return { kind: "PlanCommand", condition };
  }

  throw createError("SYN001", first.raw);
}

function parseTransitionRule(tokens) {
  if (!(tokens[0].type === "word" && tokens[0].lower === "when")) {
    throw createError("SYN001", tokens[0].raw);
  }
  let depth = 0;
  let occursIndex = -1;
  let delimiterIndex = -1;
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") depth -= 1;
    if (depth === 0 && token.type === "word" && token.lower === "occurs") {
      occursIndex = i;
      break;
    }
    if (depth === 0 && delimiterIndex === -1 && (token.type === "punct" && token.value === ",")) {
      delimiterIndex = i;
    }
    if (depth === 0 && delimiterIndex === -1 && token.type === "word" && token.lower === "then") {
      delimiterIndex = i;
    }
  }

  if (occursIndex === -1) {
    const offending = delimiterIndex !== -1 ? tokens[delimiterIndex].raw : "EOF";
    throw createError("SYN007", offending);
  }

  const conditionTokens = tokens.slice(1, occursIndex);
  const condition = parseConditionTokens(conditionTokens);
  let rest = tokens.slice(occursIndex + 1);
  if (rest[0] && rest[0].type === "punct" && rest[0].value === ",") {
    rest = rest.slice(1);
  }
  if (rest[0] && rest[0].type === "word" && rest[0].lower === "then") {
    rest = rest.slice(1);
  }
  const effect = parseSentenceFromTokens(stripCommas(rest));
  return { kind: "TransitionRuleStatement", event: condition, effect };
}

function parseActionBlock(lines) {
  const fields = {
    action: null,
    agent: null,
    preconditions: [],
    effects: [],
    intent: null,
  };
  const seen = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(action|agent|precondition|effect|intent)\s*:(.*)$/i);
    if (!match) {
      throw createError("SYN015", trimmed);
    }
    const label = match[1].toLowerCase();
    const value = match[2].trim();
    if ((label === "action" || label === "agent" || label === "intent") && seen.has(label)) {
      throw createError("SYN014", label);
    }
    seen.add(label);

    if (label === "action") fields.action = value;
    if (label === "agent") fields.agent = value;
    if (label === "precondition") fields.preconditions.push(value);
    if (label === "effect") fields.effects.push(value);
    if (label === "intent") fields.intent = value;
  }

  if (!fields.action) {
    throw createError("SYN013", "EOF", { offendingField: "Action" });
  }
  if (!fields.agent) {
    throw createError("SYN013", "EOF", { offendingField: "Agent" });
  }

  return { kind: "ActionBlock", ...fields };
}

function parseLineStatement(line) {
  const quoteMatches = line.match(/\"/g) ?? [];
  const hasUnbalancedQuotes = quoteMatches.length % 2 === 1;
  if (!line.endsWith(".") && !hasUnbalancedQuotes) {
    throw createError("SYN003", "EOF");
  }
  const content = line.endsWith(".") && !hasUnbalancedQuotes ? line.slice(0, -1).trim() : line.trim();
  const tokens = tokenize(content);
  if (tokens.length === 0) {
    throw createError("SYN002", "EOF");
  }

  const first = tokens[0];
  if (first.type === "word" && first.lower === "when") {
    return parseTransitionRule(tokens);
  }

  if (first.type === "word" && first.lower === "rule") {
    if (!(tokens[1] && tokens[1].type === "punct" && tokens[1].value === ":")) {
      throw createError("SYN015", tokens[1] ? tokens[1].raw : "EOF");
    }
    const sentence = parseSentenceFromTokens(tokens.slice(2));
    return { kind: "RuleStatement", sentence };
  }

  if (first.type === "word" && first.lower === "command") {
    if (!(tokens[1] && tokens[1].type === "punct" && tokens[1].value === ":")) {
      throw createError("SYN015", tokens[1] ? tokens[1].raw : "EOF");
    }
    const command = parseCommandFromTokens(tokens.slice(2));
    return { kind: "CommandStatement", command };
  }

  if (first.type === "word") {
    const cmd = first.lower;
    const next = tokens[1];
    let isCommand = false;
    if (cmd === "return") {
      isCommand = next && next.type === "word" && !COPULAS.has(next.lower);
    } else if (cmd === "verify") {
      isCommand = next && next.type === "word" && next.lower === "that";
    } else if (cmd === "explain") {
      isCommand = next && next.type === "word" && next.lower === "why";
    } else if (["find", "solve", "simulate", "maximize", "minimize", "plan"].includes(cmd)) {
      isCommand = true;
    }
    if (isCommand) {
      const command = parseCommandFromTokens(tokens);
      return { kind: "CommandStatement", command };
    }
  }

  const sentence = parseSentenceFromTokens(tokens);
  return { kind: "Statement", sentence };
}

function parseContextDirective(line) {
  const match = line.trim().match(/^---\s*context\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*---$/i);
  if (!match) return null;
  return { kind: "ContextDirective", name: match[1] };
}

export function parseProgram(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const items = [];
  let i = 0;

  while (i < lines.length) {
    let line = stripInlineComment(lines[i]);
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("---")) {
      const ctx = parseContextDirective(trimmed);
      if (ctx) items.push(ctx);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("//")) {
      i += 1;
      continue;
    }

    const labelMatch = trimmed.match(/^(action|agent|precondition|effect|intent)\b/i);
    if (labelMatch && !isActionLabelLine(trimmed)) {
      throw createError("SYN015", labelMatch[1]);
    }

    if (isActionLabelLine(trimmed)) {
      const blockLines = [];
      while (i < lines.length && lines[i].trim() && isActionLabelLine(lines[i])) {
        blockLines.push(lines[i]);
        i += 1;
      }
      const block = parseActionBlock(blockLines);
      items.push(block);
      continue;
    }

    items.push(parseLineStatement(trimmed));
    i += 1;
  }

  return { kind: "Program", items };
}
