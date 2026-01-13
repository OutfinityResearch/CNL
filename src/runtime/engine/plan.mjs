import { parseConditionText, parseSentenceText } from "../../parser/grammar.mjs";
import { hasVariables, runtimeError } from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { cloneKbApi } from "./clone.mjs";
import { applySentenceEffect } from "./effects.mjs";

function compileActionBlock(block) {
  const name = String(block.action ?? "Action").trim();
  const preconditions = [];
  const effects = [];
  const preconditionsText = [];
  const effectsText = [];

  try {
    block.preconditions.forEach((text) => {
      const condition = parseConditionText(text);
      if (hasVariables(condition)) {
        throw runtimeError("SES024", "Plan v1 does not support variables in preconditions.", "Precondition");
      }
      preconditions.push(condition);
      preconditionsText.push(String(text));
    });
    block.effects.forEach((text) => {
      const sentence = parseSentenceText(text);
      if (hasVariables(sentence)) {
        throw runtimeError("SES024", "Plan v1 does not support variables in effects.", "Effect");
      }
      effects.push(sentence);
      effectsText.push(String(text));
    });
  } catch (error) {
    return { error: error?.code ? error : runtimeError("SES024", error?.message ?? "Invalid action block.") };
  }

  return { action: name, preconditions, effects, preconditionsText, effectsText };
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
    return {
      kind: "PlanResult",
      status: "satisfied",
      steps: [],
      proof: {
        kind: "ProofTrace",
        mode: "PlanSearch",
        conclusion: "goal already satisfied",
        answerSummary: "steps=0",
        steps: ["Goal already holds in the current state."],
        premises: [],
      },
    };
  }
  if (actions.length === 0) {
    return {
      kind: "PlanResult",
      status: "unsatisfied",
      steps: [],
      proof: {
        kind: "ProofTrace",
        mode: "PlanSearch",
        conclusion: "no plan",
        answerSummary: "unsatisfied",
        steps: ["No actions are available."],
        premises: [],
      },
    };
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
        const proofSteps = [];
        proofSteps.push(`Search: BFS up to depth ${maxDepth}, expanded ${expanded} node(s).`);
        proofSteps.push(`Plan steps: ${nextSteps.join(" -> ")}.`);
        nextSteps.forEach((stepName, idx) => {
          const actionDef = actions.find((a) => a.action === stepName);
          if (!actionDef) return;
          proofSteps.push(`Step ${idx + 1}: ${stepName}.`);
          if (Array.isArray(actionDef.preconditionsText) && actionDef.preconditionsText.length > 0) {
            proofSteps.push(`  Preconditions: ${actionDef.preconditionsText.join(" ; ")}.`);
          }
          if (Array.isArray(actionDef.effectsText) && actionDef.effectsText.length > 0) {
            proofSteps.push(`  Effects: ${actionDef.effectsText.join(" ; ")}.`);
          }
        });
        proofSteps.push("Therefore: goal is satisfied after the final step.");
        return {
          kind: "PlanResult",
          status: "satisfied",
          steps: nextSteps,
          proof: {
            kind: "ProofTrace",
            mode: "PlanSearch",
            conclusion: "plan found",
            answerSummary: `steps=${nextSteps.length}`,
            steps: proofSteps,
            premises: [],
          },
        };
      }
      queue.push({ kbApi: nextKb, steps: nextSteps });
    }
  }

  return {
    kind: "PlanResult",
    status: "unsatisfied",
    steps: [],
    proof: {
      kind: "ProofTrace",
      mode: "PlanSearch",
      conclusion: "no plan",
      answerSummary: "unsatisfied",
      steps: [`No plan found within depth ${maxDepth} after expanding ${expanded} node(s).`],
      premises: [],
    },
  };
}
