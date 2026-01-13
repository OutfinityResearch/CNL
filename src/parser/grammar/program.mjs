import { tokenizeWithOptions } from "../../lexer/tokenizer.mjs";
import { createError } from "../../validator/errors.mjs";
import { COPULAS } from "./constants.mjs";
import { isActionLabelLine, stripInlineComment } from "./token-stream.mjs";
import { parseCommandFromTokens } from "./commands.mjs";
import { parseConditionTokens, parseSentenceFromTokens } from "./conditions.mjs";

function stripCommas(tokens) {
  return tokens.filter((token) => !(token.type === "punct" && token.value === ","));
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
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "TransitionRuleStatement",
    event: condition,
    effect,
    span: { start: startToken.start, end: endToken.end },
  };
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

  return {
    kind: "ActionBlock",
    ...fields,
    span: { start: 0, end: 0 },
  };
}

function parseLineStatement(line, baseOffset = 0) {
  const quoteMatches = line.match(/\"/g) ?? [];
  const hasUnbalancedQuotes = quoteMatches.length % 2 === 1;
  if (!line.endsWith(".") && !hasUnbalancedQuotes) {
    throw createError("SYN003", "EOF");
  }
  const content = line.endsWith(".") && !hasUnbalancedQuotes ? line.slice(0, -1).trim() : line.trim();
  const tokens = tokenizeWithOptions(content, { offset: baseOffset });
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
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "RuleStatement",
      sentence,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.type === "word" && first.lower === "command") {
    if (!(tokens[1] && tokens[1].type === "punct" && tokens[1].value === ":")) {
      throw createError("SYN015", tokens[1] ? tokens[1].raw : "EOF");
    }
    const command = parseCommandFromTokens(tokens.slice(2));
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "CommandStatement",
      command,
      span: { start: startToken.start, end: endToken.end },
    };
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
      const startToken = tokens[0];
      const endToken = tokens[tokens.length - 1];
      return {
        kind: "CommandStatement",
        command,
        span: { start: startToken.start, end: endToken.end },
      };
    }
  }

  const sentence = parseSentenceFromTokens(tokens);
  const startToken = tokens[0];
  const endToken = tokens[tokens.length - 1];
  return {
    kind: "Statement",
    sentence,
    span: { start: startToken.start, end: endToken.end },
  };
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
  let cursor = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const lineStartOffset = cursor;
    let line = stripInlineComment(rawLine);
    if (!line.trim()) {
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("---")) {
      const ctx = parseContextDirective(trimmed);
      if (!ctx) {
        throw createError("SYN016", trimmed);
      }
      items.push(ctx);
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    if (trimmed.startsWith("//")) {
      i += 1;
      cursor += rawLine.length + 1;
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
        cursor += lines[i - 1].length + 1;
      }
      const block = parseActionBlock(blockLines);
      items.push(block);
      continue;
    }

    const leading = line.indexOf(trimmed);
    const baseOffset = lineStartOffset + Math.max(leading, 0);
    items.push(parseLineStatement(trimmed, baseOffset));
    i += 1;
    cursor += rawLine.length + 1;
  }

  return {
    kind: "Program",
    items,
    span: { start: 0, end: source.length },
  };
}

export function parseProgramIncremental(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const items = [];
  const errors = [];
  let i = 0;
  let cursor = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const lineStartOffset = cursor;
    let line = stripInlineComment(rawLine);
    if (!line.trim()) {
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("---")) {
      const ctx = parseContextDirective(trimmed);
      if (ctx) {
        items.push(ctx);
      } else {
        errors.push(createError("SYN016", trimmed));
      }
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    if (trimmed.startsWith("//")) {
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    const labelMatch = trimmed.match(/^(action|agent|precondition|effect|intent)\b/i);
    if (labelMatch && !isActionLabelLine(trimmed)) {
      errors.push(createError("SYN015", labelMatch[1]));
      i += 1;
      cursor += rawLine.length + 1;
      continue;
    }

    if (isActionLabelLine(trimmed)) {
      const blockLines = [];
      while (i < lines.length && lines[i].trim() && isActionLabelLine(lines[i])) {
        blockLines.push(lines[i]);
        i += 1;
        cursor += lines[i - 1].length + 1;
      }
      try {
        const block = parseActionBlock(blockLines);
        items.push(block);
      } catch (error) {
        errors.push(error?.code ? error : createError("SYN001", "EOF"));
      }
      continue;
    }

    const leading = line.indexOf(trimmed);
    const baseOffset = lineStartOffset + Math.max(leading, 0);
    try {
      items.push(parseLineStatement(trimmed, baseOffset));
    } catch (error) {
      errors.push(error?.code ? error : createError("SYN001", trimmed));
    }
    i += 1;
    cursor += rawLine.length + 1;
  }

  return {
    program: { kind: "Program", items, span: { start: 0, end: source.length } },
    errors,
  };
}
