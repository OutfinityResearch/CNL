import { createError } from "../../validator/errors.mjs";
import {
  DETERMINERS,
  QUANTIFIERS,
  PREPOSITIONS,
  KEYWORDS,
} from "./constants.mjs";

export class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.last = null;
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
    this.last = token;
    return token;
  }

  matchWord(value) {
    const token = this.peek();
    if (token.type === "word" && token.lower === value) {
      this.pos += 1;
      this.last = token;
      return token;
    }
    return null;
  }

  matchPunct(value) {
    const token = this.peek();
    if (token.type === "punct" && token.value === value) {
      this.pos += 1;
      this.last = token;
      return token;
    }
    return null;
  }

  done() {
    return this.pos >= this.tokens.length;
  }
}

export function stripInlineComment(line) {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  return line.slice(0, idx);
}

export function isActionLabelLine(line) {
  return /^(action|agent|precondition|effect|intent)\s*:/i.test(line.trim());
}

export function ensureBalancedParentheses(tokens) {
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

export function isDeterminerToken(token) {
  return token.type === "word" && DETERMINERS.has(token.lower);
}

export function isQuantifierToken(token) {
  return token.type === "word" && QUANTIFIERS.has(token.lower);
}

export function shouldTreatAsNameToken(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (token.raw === "A" && token.lower === "a") {
    if (!nextToken) return true;
    if (nextToken.type === "word" && PREPOSITIONS.has(nextToken.lower)) return true;
    if (nextToken.type === "punct" && nextToken.value !== "(") return true;
  }
  return false;
}

export function isStartOfNounPhrase(token, nextToken) {
  if (!token || token.type !== "word") return false;
  if (shouldTreatAsNameToken(token, nextToken)) return false;
  if (isDeterminerToken(token) || isQuantifierToken(token)) return true;
  if (token.lower === "at" && nextToken && (nextToken.lower === "least" || nextToken.lower === "most")) {
    return true;
  }
  return false;
}

export function guardKeywordAsName(token) {
  if (token.type === "word" && KEYWORDS.has(token.lower)) {
    throw createError("LEX003", token.raw);
  }
}
