import { createError, formatResultOutput, getStats, getSummary, json, normalizeCommandError, parseProgramSafe, readBody } from "../helpers.mjs";
import * as NLG from "../../nlg.mjs";

export async function handleCommand(req, res, url, context) {
  if (req.method !== "POST" || url.pathname !== "/api/command") return false;
  let body = null;
  try {
    body = await readBody(req);
  } catch (error) {
    json(res, 400, { ok: false, errors: [createError("CMD002", "Invalid JSON body.")] });
    return true;
  }
  const text = body.text || "";
  const trimmed = text.trim();
  if (!trimmed) {
    json(res, 400, { ok: false, errors: [createError("CMD003", "Missing command text.")] });
    return true;
  }

  const { ast, error } = parseProgramSafe(text);
  if (error || !ast) {
    const parseError = normalizeCommandError(error);
    json(res, 200, { ok: false, errors: [parseError], message: NLG.errorMessage(parseError) });
    return true;
  }

  const commandItems = ast.items.filter((item) => item.kind === "CommandStatement");
  if (commandItems.length === 0) {
    const statsBefore = getSummary(context.session);
    const result = context.session.learnText(text);
    const statsAfter = getSummary(context.session);

    const changes = {
      newEntities: [],
      newCategories: [],
      newFacts:
        statsAfter.things - statsBefore.things +
        (statsAfter.categories - statsBefore.categories) +
        (statsAfter.relationships - statsBefore.relationships),
      newRules: statsAfter.rules - statsBefore.rules,
    };

    const message =
      result.errors.length === 0 ? NLG.learnMessage(text, changes) : NLG.errorMessage(result.errors[0]);

    json(res, 200, {
      ok: result.errors.length === 0,
      mode: "learn",
      errors: result.errors,
      applied: result.applied,
      changes,
      message,
      summary: statsAfter,
      stats: getStats(context.session),
    });
    return true;
  }

  if (commandItems.length !== ast.items.length) {
    json(res, 200, {
      ok: false,
      errors: [createError("CMD004", "Commands must not include statements.")],
      message: "Commands cannot be mixed with statements.",
    });
    return true;
  }

  if (commandItems.length !== 1) {
    json(res, 200, {
      ok: false,
      errors: [createError("CMD005", "Only one command is allowed per request.")],
      message: "Please enter one command at a time.",
    });
    return true;
  }

  const command = commandItems[0].command;
  let result = null;
  let contextInfo = {};

  if (command.kind === "ReturnCommand" || command.kind === "FindCommand") {
    result = context.session.query(text);
    if (command.selector?.kind === "NounPhrase") {
      contextInfo.category = command.selector.core?.join(" ");
    }
  } else if (command.kind === "VerifyCommand") {
    result = context.session.proof(text);
    if (command.proposition?.kind === "AtomicCondition") {
      const assertion = command.proposition.assertion;
      if (assertion?.subject?.kind === "Name") {
        contextInfo.subject = assertion.subject.value;
      }
      if (assertion?.complement?.kind === "Name") {
        contextInfo.predicate = assertion.complement.value;
      }
    }
  } else if (command.kind === "ExplainCommand") {
    result = context.session.explain(text);
  } else if (command.kind === "PlanCommand") {
    result = context.session.plan(text);
  } else if (command.kind === "SolveCommand") {
    result = context.session.solve(text);
  } else if (command.kind === "SimulateCommand") {
    result = context.session.simulate(text);
  } else if (command.kind === "MaximizeCommand" || command.kind === "MinimizeCommand") {
    result = context.session.optimize(text);
  } else {
    result = { error: `Unsupported command: ${command.kind}` };
  }

  const commandError = normalizeCommandError(result?.error);
  if (commandError) {
    json(res, 200, { ok: false, errors: [commandError], message: NLG.errorMessage(commandError) });
    return true;
  }

  json(res, 200, {
    ok: true,
    mode: "command",
    result,
    message: formatResultOutput(result, contextInfo),
    summary: getSummary(context.session),
    stats: getStats(context.session),
  });
  return true;
}
