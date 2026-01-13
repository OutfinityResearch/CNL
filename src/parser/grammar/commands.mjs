import { createError } from "../../validator/errors.mjs";
import { TokenStream } from "./token-stream.mjs";
import { parseConditionTokens } from "./conditions.mjs";
import { parseExpr, parseVariable } from "./expressions.mjs";

export function parseCommandFromTokens(tokens) {
  const stream = new TokenStream(tokens);
  const first = stream.peek();
  if (!(first.type === "word")) {
    throw createError("SYN001", first.raw);
  }

  if (first.lower === "return") {
    stream.consume();
    const expr = parseExpr(stream);
    if (!stream.done()) throw createError("SYN001", stream.peek().raw);
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "ReturnCommand",
      expr,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.lower === "verify") {
    stream.consume();
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const proposition = parseConditionTokens(stream.tokens.slice(stream.pos));
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "VerifyCommand",
      proposition,
      span: { start: startToken.start, end: endToken.end },
    };
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
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "FindCommand",
      expr,
      constraint,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.lower === "solve") {
    stream.consume();
    if (!stream.matchWord("for")) {
      throw createError("SYN006", stream.peek().raw);
    }
    let expr = null;
    let variables = null;
    if (stream.peek().type === "var") {
      variables = [];
      variables.push(parseVariable(stream));
      while (true) {
        if (stream.peek().type === "punct" && stream.peek().value === ",") {
          stream.consume();
          variables.push(parseVariable(stream));
          continue;
        }
        if (stream.peek().type === "word" && stream.peek().lower === "and") {
          stream.consume();
          variables.push(parseVariable(stream));
          continue;
        }
        break;
      }
    } else {
      expr = parseExpr(stream);
    }
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    if (stream.done()) {
      return {
        kind: "SolveCommand",
        expr,
        variables,
        constraint: null,
        span: { start: startToken.start, end: endToken.end },
      };
    }
    if (!stream.matchWord("such")) {
      throw createError("SYN006", stream.peek().raw);
    }
    if (!stream.matchWord("that")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const constraint = parseConditionTokens(stream.tokens.slice(stream.pos));
    return {
      kind: "SolveCommand",
      expr,
      variables,
      constraint,
      span: { start: startToken.start, end: endToken.end },
    };
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
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind,
      objective,
      constraint,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.lower === "explain") {
    stream.consume();
    if (!stream.matchWord("why")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const proposition = parseConditionTokens(stream.tokens.slice(stream.pos));
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "ExplainCommand",
      proposition,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.lower === "plan") {
    stream.consume();
    if (!stream.matchWord("to") || !stream.matchWord("achieve")) {
      throw createError("SYN006", stream.peek().raw);
    }
    const condition = parseConditionTokens(stream.tokens.slice(stream.pos));
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "PlanCommand",
      condition,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  if (first.lower === "simulate") {
    stream.consume();
    const stepsToken = stream.peek();
    if (!(stepsToken.type === "number")) {
      throw createError("SYN006", stepsToken.raw);
    }
    const steps = Number(stepsToken.value);
    stream.consume();
    if (!stream.matchWord("steps")) {
      throw createError("SYN006", stream.peek().raw);
    }
    if (!stream.done()) {
      throw createError("SYN001", stream.peek().raw);
    }
    const startToken = tokens[0];
    const endToken = tokens[tokens.length - 1];
    return {
      kind: "SimulateCommand",
      steps,
      span: { start: startToken.start, end: endToken.end },
    };
  }

  throw createError("SYN001", first.raw);
}
