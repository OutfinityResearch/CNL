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

function matchWords(tokens, pos, words) {
  for (let i = 0; i < words.length; i += 1) {
    const token = tokens[pos + i];
    if (!token || token.type !== "word") return false;
    if (token.lower !== words[i]) return false;
  }
  return true;
}

function findNextAtomicStop(tokens, start) {
  for (let i = start; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === ")") return i;
    if (token.type !== "word") continue;
    if (token.lower === "and") return i;
    if (token.lower === "or" && !isComparatorOrToken(tokens, i)) return i;
  }
  return tokens.length;
}

function findNextTopLevelBooleanOp(tokens, start) {
  let depth = 0;
  for (let i = start; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "punct" && token.value === "(") depth += 1;
    if (token.type === "punct" && token.value === ")") {
      if (depth === 0) return i;
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (token.type === "word" && token.lower === "and") return i;
    if (token.type === "word" && token.lower === "or" && !isComparatorOrToken(tokens, i)) return i;
  }
  return tokens.length;
}

function splitOnKeywordTopLevel(tokens, keyword) {
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

export function parseConditionTokensPratt(tokens, parseAssertionFromTokens, createError) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw createError("SYN002", "EOF");
  }

  let pos = 0;

  function parseGroup() {
    const startToken = tokens[pos];
    pos += 1; // (
    const innerTokens = [];
    let depth = 1;
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === "punct" && token.value === "(") depth += 1;
      if (token.type === "punct" && token.value === ")") depth -= 1;
      if (depth === 0) break;
      innerTokens.push(token);
      pos += 1;
    }
    const endToken = tokens[pos];
    if (!endToken || !(endToken.type === "punct" && endToken.value === ")")) {
      throw createError("SYN001", startToken.raw);
    }
    pos += 1; // )
    return {
      kind: "GroupCondition",
      inner: parseConditionTokensPratt(innerTokens, parseAssertionFromTokens, createError),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  function parseSpecialRemainder() {
    const remaining = tokens.slice(pos);
    const startToken = remaining[0];
    const endToken = remaining[remaining.length - 1];

    if (matchWords(remaining, 0, ["it", "is", "not", "the", "case", "that"])) {
      const phraseLen = 6;
      const operandStart = pos + phraseLen;
      const operandEnd = findNextTopLevelBooleanOp(tokens, operandStart);
      const operandTokens = tokens.slice(operandStart, operandEnd);
      if (operandTokens.length === 0) throw createError("SYN001", startToken.raw);
      pos = operandEnd;
      const operandEndToken = operandTokens[operandTokens.length - 1];
      return {
        kind: "CaseScope",
        mode: "negative",
        operand: parseConditionTokensPratt(operandTokens, parseAssertionFromTokens, createError),
        span: { start: startToken.start, end: operandEndToken.end },
      };
    }

    if (matchWords(remaining, 0, ["it", "is", "the", "case", "that"])) {
      const phraseLen = 5;
      const operandStart = pos + phraseLen;
      const operandEnd = findNextTopLevelBooleanOp(tokens, operandStart);
      const operandTokens = tokens.slice(operandStart, operandEnd);
      if (operandTokens.length === 0) throw createError("SYN001", startToken.raw);
      pos = operandEnd;
      const operandEndToken = operandTokens[operandTokens.length - 1];
      return {
        kind: "CaseScope",
        mode: "positive",
        operand: parseConditionTokensPratt(operandTokens, parseAssertionFromTokens, createError),
        span: { start: startToken.start, end: operandEndToken.end },
      };
    }

    if (remaining[0]?.type === "word" && remaining[0].lower === "either") {
      const split = splitOnKeywordTopLevel(remaining.slice(1), "or");
      if (!split) throw createError("SYN001", remaining[0].raw);
      pos = tokens.length;
      return {
        kind: "EitherOr",
        left: parseConditionTokensPratt(split.left, parseAssertionFromTokens, createError),
        right: parseConditionTokensPratt(split.right, parseAssertionFromTokens, createError),
        span: { start: startToken.start, end: endToken.end },
      };
    }

    if (remaining[0]?.type === "word" && remaining[0].lower === "both") {
      const split = splitOnKeywordTopLevel(remaining.slice(1), "and");
      if (!split) throw createError("SYN001", remaining[0].raw);
      pos = tokens.length;
      return {
        kind: "BothAnd",
        left: parseConditionTokensPratt(split.left, parseAssertionFromTokens, createError),
        right: parseConditionTokensPratt(split.right, parseAssertionFromTokens, createError),
        span: { start: startToken.start, end: endToken.end },
      };
    }

    return null;
  }

  function parseAtomicCondition() {
    const start = pos;
    const stop = findNextAtomicStop(tokens, start);
    if (stop === start) throw createError("SYN001", tokens[start].raw);
    const slice = tokens.slice(start, stop);
    pos = stop;
    const startToken = slice[0];
    const endToken = slice[slice.length - 1];
    return {
      kind: "AtomicCondition",
      assertion: parseAssertionFromTokens(slice),
      span: { start: startToken.start, end: endToken.end },
    };
  }

  function parsePrimary() {
    if (pos >= tokens.length) throw createError("SYN002", "EOF");

    if (tokens[pos].type === "punct" && tokens[pos].value === "(") {
      return parseGroup();
    }

    const special = parseSpecialRemainder();
    if (special) return special;

    return parseAtomicCondition();
  }

  function parseExpression() {
    const items = [];
    let chainOp = null;
    let offendingToken = null;

    items.push(parsePrimary());

    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === "punct" && token.value === ")") break;
      if (!(token.type === "word" && (token.lower === "and" || token.lower === "or"))) break;
      if (token.lower === "or" && isComparatorOrToken(tokens, pos)) break;

      if (!chainOp) chainOp = token.lower;
      if (chainOp !== token.lower && !offendingToken) offendingToken = token;
      if (chainOp !== token.lower) {
        throw createError("SYN011", offendingToken.raw);
      }

      pos += 1; // operator
      items.push(parsePrimary());
    }

    if (!chainOp) return items[0];

    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: chainOp === "and" ? "AndChain" : "OrChain",
      items,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  const out = parseExpression();
  if (pos !== tokens.length) {
    const token = tokens[pos];
    throw createError("SYN001", token?.raw ?? "EOF");
  }
  return out;
}
