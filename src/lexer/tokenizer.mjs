import { createError } from "../validator/errors.mjs";

const isLetter = (ch) => /[A-Za-z_]/.test(ch);
const isDigit = (ch) => /[0-9]/.test(ch);
const isAlnum = (ch) => /[A-Za-z0-9_]/.test(ch);

export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "." || ch === "," || ch === ":" || ch === "(" || ch === ")") {
      tokens.push({ type: "punct", value: ch, raw: ch, lower: ch, start: i, end: i + 1 });
      i += 1;
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
        start,
        end: i,
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
        start,
        end: i,
      });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      let raw = "";
      while (i < input.length && isAlnum(input[i])) {
        raw += input[i];
        i += 1;
      }
      tokens.push({
        type: "word",
        value: raw,
        raw,
        lower: raw.toLowerCase(),
        start,
        end: i,
      });
      continue;
    }

    throw createError("LEX001", ch);
  }

  return tokens;
}
