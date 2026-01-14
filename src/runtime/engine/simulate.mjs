import { hasVariables, runtimeError } from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { cloneKbApi } from "./clone.mjs";
import { applySentenceEffect } from "./effects.mjs";
import { renderConditionText, renderSentenceText } from "./ast-render.mjs";

function summarizeState(kbState, step) {
  return {
    step,
    entities: kbState.entitiesCount,
    predicates: kbState.predicatesCount,
    unaries: kbState.unaryCount,
    attributes: kbState.attributesCount,
  };
}

function renderTransitionRuleSummary(ruleId, rule) {
  if (!rule || (rule.kind !== "TransitionRule" && rule.kind !== "TransitionRuleStatement")) {
    return `Transition rule #${ruleId}`;
  }
  const event = renderConditionText(rule.event);
  const effect = renderSentenceText(rule.effect);
  const whenText = event ? `When ${event} occurs` : "When an event occurs";
  const thenText = effect || "nothing happens";
  return `${whenText}, then ${thenText}.`;
}

export function simulateTransitions(command, state) {
  if (hasVariables(command)) {
    return { error: runtimeError("SES026", "Simulate v1 does not support variables.", "Simulate") };
  }

  const rules = [];
  const allRules = state.ruleStore.getRules();
  for (let ruleId = 0; ruleId < allRules.length; ruleId += 1) {
    const rule = allRules[ruleId];
    if (rule?.kind === "TransitionRule" || rule?.kind === "TransitionRuleStatement") {
      rules.push({ ruleId, rule });
    }
  }

  const kbApi = cloneKbApi(state.kb);
  const snapshots = [];
  const steps = Number.isInteger(command.steps) ? command.steps : 0;
  const proofSteps = [];

  for (let step = 0; step <= steps; step += 1) {
    snapshots.push(summarizeState(kbApi.kb, step));
    if (step === steps) break;

    const evalState = { ...state, kb: kbApi };
    const fired = [];
    for (const entry of rules) {
      const rule = entry.rule;
      if (hasVariables(rule)) {
        return { error: runtimeError("SES026", "Transition rules must be ground in v1.", "TransitionRule") };
      }
      if (evaluateCondition(rule.event, evalState)) {
        const error = applySentenceEffect(rule.effect, kbApi, state);
        if (error) return { error };
        fired.push(entry);
      }
    }

    if (fired.length === 0) {
      proofSteps.push(`Step ${step + 1}: no transition rule fired.`);
    } else {
      proofSteps.push(`Step ${step + 1}: fired ${fired.length} transition rule(s).`);
      for (const entry of fired) {
        proofSteps.push(`  Applied: ${renderTransitionRuleSummary(entry.ruleId, entry.rule)}`);
      }
    }
  }

  const final = snapshots[snapshots.length - 1] ?? summarizeState(kbApi.kb, steps);
  proofSteps.push(
    `Final state: entities=${final.entities}, predicates=${final.predicates}, unaries=${final.unaries}, attributes=${final.attributes}.`
  );

  return {
    kind: "SimulationResult",
    steps,
    states: snapshots,
    proof: {
      kind: "ProofTrace",
      mode: "Simulation",
      conclusion: `simulate ${steps} step(s)`,
      answerSummary: `steps=${steps}`,
      steps: proofSteps,
      premises: [],
    },
  };
}
