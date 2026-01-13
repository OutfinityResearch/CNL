import { hasVariables, runtimeError } from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { cloneKbApi } from "./clone.mjs";
import { applySentenceEffect } from "./effects.mjs";

function summarizeState(kbState, step) {
  return {
    step,
    entities: kbState.entitiesCount,
    predicates: kbState.predicatesCount,
    unaries: kbState.unaryCount,
    attributes: kbState.attributesCount,
  };
}

export function simulateTransitions(command, state) {
  if (hasVariables(command)) {
    return { error: runtimeError("SES026", "Simulate v1 does not support variables.", "Simulate") };
  }

  const rules = state.ruleStore.getRules().filter((rule) => rule?.kind === "TransitionRule");
  const kbApi = cloneKbApi(state.kb);
  const snapshots = [];
  const steps = Number.isInteger(command.steps) ? command.steps : 0;

  for (let step = 0; step <= steps; step += 1) {
    snapshots.push(summarizeState(kbApi.kb, step));
    if (step === steps) break;

    const evalState = { ...state, kb: kbApi };
    for (const rule of rules) {
      if (hasVariables(rule)) {
        return { error: runtimeError("SES026", "Transition rules must be ground in v1.", "TransitionRule") };
      }
      if (evaluateCondition(rule.event, evalState)) {
        const error = applySentenceEffect(rule.effect, kbApi, state);
        if (error) return { error };
      }
    }
  }

  return { kind: "SimulationResult", steps, states: snapshots };
}
