import { tokenizeWithOptions } from "../../lexer/tokenizer.mjs";
import { createError } from "../../validator/errors.mjs";
import {
  PREPOSITIONS,
  RELATIVE_PRONOUNS,
  COPULAS,
} from "./constants.mjs";
import { TokenStream, ensureBalancedParentheses } from "./token-stream.mjs";
import {
  parseAttributeRef,
  parseExpr,
  parseIdentifier,
  parseName,
  parseNounPhrase,
  parseObjectRef,
  parseVerbGroup,
} from "./expressions.mjs";
import { parseComparatorOrNull } from "./comparators.mjs";
import { isStartOfNounPhrase, isDeterminerToken } from "./token-stream.mjs";

export function parseAssertionFromTokens(tokens) {
  const stream = new TokenStream(tokens);
  const left = parseExpr(stream);

  const comparator = parseComparatorOrNull(stream);
  if (comparator) {
    const right = parseExpr(stream);
    if (!stream.done()) {
      throw createError("SYN001", stream.peek().raw);
    }
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "ComparisonAssertion",
      left,
      comparator,
      right,
      span: { start: startToken.start, end: endToken.end },
    };
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
      const startToken = tokens[0];
      const endToken = tokens[tokens.length - 1];
      return {
        kind: "AttributeAssertion",
        subject,
        determiner,
        attribute,
        value,
        span: { start: startToken.start, end: endToken.end },
      };
    }
    const remainder = stream.tokens.slice(stream.pos + 1);
    if (remainder.some((token) => token.type === "word" && token.lower === "of")) {
      throw createError("SYN008", stream.peek(1).raw);
    }
  }

  if (next.type === "word" && COPULAS.has(next.lower)) {
    const copula = stream.consume().lower;
    
    // Check for negation: "is not", "are not", etc.
    let negated = false;
    if (stream.peek().type === "word" && stream.peek().lower === "not") {
      stream.consume();
      negated = true;
    }
    
    const peek1 = stream.peek(1);
    if (stream.peek().type === "word" && peek1 && PREPOSITIONS.has(peek1.lower)) {
      const verb = parseIdentifier(stream).raw;
      const preposition = stream.consume().lower;
      const object = parseObjectRef(stream);
      if (!stream.done()) {
        throw createError("SYN001", stream.peek().raw);
      }
      const startToken = tokens[0];
      const endToken = tokens[tokens.length - 1];
      return {
        kind: "PassiveRelationAssertion",
        subject,
        copula,
        negated,
        verb,
        preposition,
        object,
        span: { start: startToken.start, end: endToken.end },
      };
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
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "CopulaPredicateAssertion",
      subject,
      copula,
      negated,
      complement,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  // Active relation negation: "X does not <verb> Y."
  if (next.type === "word" && next.lower === "does" && stream.peek(1).type === "word" && stream.peek(1).lower === "not") {
    stream.consume(); // does
    stream.consume(); // not
    const verb = parseIdentifier(stream).raw;
    const particles = [];
    while (stream.peek().type === "word" && PREPOSITIONS.has(stream.peek().lower)) {
      particles.push(stream.consume().lower);
    }
    const verbGroup = { kind: "VerbGroup", auxiliary: null, verb, particles, span: { start: next.start, end: stream.last?.end ?? next.end } };
    const object = parseObjectRef(stream);
    if (!stream.done()) {
      throw createError("SYN001", stream.peek().raw);
    }
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "ActiveRelationAssertion",
      subject,
      negated: true,
      verbGroup,
      object,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  const verbGroup = parseVerbGroup(stream);
  const object = parseObjectRef(stream);
  if (!stream.done()) {
    throw createError("SYN001", stream.peek().raw);
  }
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "ActiveRelationAssertion",
    subject,
    negated: false,
    verbGroup,
    object,
    span: { start: startToken.start, end: endToken.end },
  };
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

export function parseConditionTokens(tokens) {
  const filtered = stripCommas(tokens);
  ensureBalancedParentheses(filtered);

  if (tokensAreWrapped(filtered)) {
    const inner = filtered.slice(1, -1);
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "GroupCondition",
      inner: parseConditionTokens(inner),
      span: { start: startToken.start, end: endToken.end },
    };
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
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "CaseScope",
      mode: "negative",
      operand: parseConditionTokens(rest),
      span: { start: startToken.start, end: endToken.end },
    };
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
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "CaseScope",
      mode: "positive",
      operand: parseConditionTokens(rest),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (filtered[0].lower === "either") {
    const split = splitOnKeyword(filtered.slice(1), "or");
    if (!split) {
      throw createError("SYN001", filtered[0].raw);
    }
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "EitherOr",
      left: parseConditionTokens(split.left),
      right: parseConditionTokens(split.right),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (filtered[0].lower === "both") {
    const split = splitOnKeyword(filtered.slice(1), "and");
    if (!split) {
      throw createError("SYN001", filtered[0].raw);
    }
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "BothAnd",
      left: parseConditionTokens(split.left),
      right: parseConditionTokens(split.right),
      span: { start: startToken.start, end: endToken.end },
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
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "AndChain",
      items: parts.map((part) => parseConditionTokens(part)),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (hasOr) {
    const parts = splitByOperator(filtered, "or");
    const startToken = filtered[0];
    const endToken = filtered[filtered.length - 1];
    return {
      kind: "OrChain",
      items: parts.map((part) => parseConditionTokens(part)),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  const startToken = filtered[0];
  const endToken = filtered[filtered.length - 1];
  return {
    kind: "AtomicCondition",
    assertion: parseAssertionFromTokens(filtered),
    span: { start: startToken.start, end: endToken.end },
  };
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
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "ConditionalSentence",
    condition,
    then: thenSentence,
    span: { start: startToken.start, end: endToken.end },
  };
}

function parseConditionalPostfix(tokens, ifSplit) {
  const conditionTokens = tokens.slice(ifSplit.index + 1);
  const thenTokens = tokens.slice(0, ifSplit.index);
  const condition = parseConditionTokens(conditionTokens);
  const thenSentence = parseSentenceFromTokens(stripCommas(thenTokens));
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "ConditionalSentence",
    condition,
    then: thenSentence,
    span: { start: startToken.start, end: endToken.end },
  };
}

export function parseSentenceFromTokens(tokens) {
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
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "BecauseSentence",
      assertion,
      because,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  const ifSplit = splitOnKeyword(tokens, "if");
  if (ifSplit) {
    return parseConditionalPostfix(tokens, ifSplit);
  }

  const assertion = parseAssertionFromTokens(stripCommas(tokens));
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "AssertionSentence",
    assertion,
    span: { start: startToken.start, end: endToken.end },
  };
}

export function parseConditionText(source, offset = 0) {
  const text = String(source ?? "").trim();
  const tokens = tokenizeWithOptions(text, { offset });
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    if (last.type === "punct" && last.value === ".") {
      tokens.pop();
    }
  }
  if (tokens.length === 0) {
    throw createError("SYN002", "EOF");
  }
  return parseConditionTokens(tokens);
}

export function parseSentenceText(source, offset = 0) {
  const text = String(source ?? "").trim();
  const tokens = tokenizeWithOptions(text, { offset });
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    if (last.type === "punct" && last.value === ".") {
      tokens.pop();
    }
  }
  if (tokens.length === 0) {
    throw createError("SYN002", "EOF");
  }
  return parseSentenceFromTokens(tokens);
}
