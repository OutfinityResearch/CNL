import { createError } from "../validator/errors.mjs";

const isLetter = (ch) => /[A-Za-z_]/.test(ch);
const isDigit = (ch) => /[0-9]/.test(ch);
const isIdentTail = (ch) => /[A-Za-z0-9_-]/.test(ch);

export function tokenize(input) {
  return tokenizeWithOptions(input, {});
}

export function tokenizeWithOptions(input, options = {}) {
  const tokens = [];
  let i = 0;
  const offset = Number.isInteger(options.offset) ? options.offset : 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "." || ch === "," || ch === ":" || ch === "(" || ch === ")") {
      tokens.push({ type: "punct", value: ch, raw: ch, lower: ch, start: offset + i, end: offset + i + 1 });
      i += 1;
      continue;
    }

    if (ch === "?") {
      const start = i;
      i += 1;
      if (i >= input.length || !isLetter(input[i])) {
        throw createError("LEX005", "?");
      }
      let name = "";
      while (i < input.length && isIdentTail(input[i])) {
        name += input[i];
        i += 1;
      }
      const raw = `?${name}`;
      tokens.push({
        type: "var",
        value: name,
        raw,
        lower: name.toLowerCase(),
        start: offset + start,
        end: offset + i,
      });
      continue;
    }

    if (ch === '"') {
      const start = i;
      i += 1;
      let value = "";
      let closed = false;
      while (i < input.length) {
        const current = input[i];
        if (current === "\\") {
          const next = input[i + 1];
          if (next === "\"" || next === "\\" || next === "n" || next === "t") {
            value += "\\" + next;
            i += 2;
            continue;
          }
        }
        if (current === '"') {
          closed = true;
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }
      if (!closed) {
        const fragment = input.slice(start);
        throw createError("LEX002", fragment);
      }
      tokens.push({
        type: "string",
        value,
        raw: input.slice(start, i),
        lower: value.toLowerCase(),
        start: offset + start,
        end: offset + i,
      });
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      let raw = "";
      while (i < input.length && isDigit(input[i])) {
        raw += input[i];
        i += 1;
      }
      if (input[i] === ".") {
        if (!isDigit(input[i + 1])) {
          raw += ".";
          i += 1;
          throw createError("LEX004", raw);
        }
        raw += ".";
        i += 1;
        while (i < input.length && isDigit(input[i])) {
          raw += input[i];
          i += 1;
        }
      }
      tokens.push({
        type: "number",
        value: raw,
        raw,
        lower: raw.toLowerCase(),
        start: offset + start,
        end: offset + i,
      });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      let raw = "";
      while (i < input.length && isIdentTail(input[i])) {
        raw += input[i];
        i += 1;
      }
      tokens.push({
        type: "word",
        value: raw,
        raw,
        lower: raw.toLowerCase(),
        start: offset + start,
        end: offset + i,
      });
      continue;
    }

    throw createError("LEX001", ch);
  }

  return tokens;
}
