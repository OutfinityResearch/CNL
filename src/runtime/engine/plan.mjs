import { parseConditionText, parseSentenceText } from "../../parser/grammar.mjs";
import { hasVariables, runtimeError } from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { cloneKbApi } from "./clone.mjs";
import { applySentenceEffect } from "./effects.mjs";

function compileActionBlock(block) {
  const name = String(block.action ?? "Action").trim();
  const preconditions = [];
  const effects = [];

  try {
    block.preconditions.forEach((text) => {
      const condition = parseConditionText(text);
      if (hasVariables(condition)) {
        throw runtimeError("SES024", "Plan v1 does not support variables in preconditions.", "Precondition");
      }
      preconditions.push(condition);
    });
    block.effects.forEach((text) => {
      const sentence = parseSentenceText(text);
      if (hasVariables(sentence)) {
        throw runtimeError("SES024", "Plan v1 does not support variables in effects.", "Effect");
      }
      effects.push(sentence);
    });
  } catch (error) {
    return { error: error?.code ? error : runtimeError("SES024", error?.message ?? "Invalid action block.") };
  }

  return { action: name, preconditions, effects };
}

function compileActions(state) {
  const actions = [];
  const blocks = state.actionStore.getActions();
  for (const block of blocks) {
    const compiled = compileActionBlock(block);
    if (compiled.error) {
      return { error: compiled.error };
    }
    actions.push(compiled);
  }
  return { actions };
}

export function planWithActions(command, state) {
  if (hasVariables(command.condition)) {
    return { error: runtimeError("SES024", "Plan v1 does not support variables.", "Plan") };
  }

  const compiled = compileActions(state);
  if (compiled.error) return { error: compiled.error };
  const actions = compiled.actions ?? [];
  if (evaluateCondition(command.condition, state)) {
    return { kind: "PlanResult", status: "satisfied", steps: [] };
  }
  if (actions.length === 0) {
    return { kind: "PlanResult", status: "unsatisfied", steps: [] };
  }

  const maxDepth = 6;
  const maxNodes = 200;
  const queue = [{ kbApi: state.kb, steps: [] }];
  let expanded = 0;

  while (queue.length > 0 && expanded < maxNodes) {
    const node = queue.shift();
    expanded += 1;
    if (node.steps.length >= maxDepth) continue;

    for (const action of actions) {
      const evalState = { ...state, kb: node.kbApi };
      const ok = action.preconditions.every((cond) => evaluateCondition(cond, evalState));
      if (!ok) continue;

      const nextKb = cloneKbApi(node.kbApi);
      for (const effect of action.effects) {
        const error = applySentenceEffect(effect, nextKb, state);
        if (error) return { error };
      }

      const nextSteps = [...node.steps, action.action];
      const nextState = { ...state, kb: nextKb };
      if (evaluateCondition(command.condition, nextState)) {
        return { kind: "PlanResult", status: "satisfied", steps: nextSteps };
      }
      queue.push({ kbApi: nextKb, steps: nextSteps });
    }
  }

  return { kind: "PlanResult", status: "unsatisfied", steps: [] };
}
