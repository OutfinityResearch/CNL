import { Plans } from "../../plans/ir.mjs";
import { executeSet } from "../../plans/execute.mjs";
import { compileCondition, compileNP } from "../../compiler/ast-to-plan.mjs";
import { isUniversalNounPhrase } from "./helpers.mjs";

export function evaluateCondition(condition, state) {
  if (!condition) return false;

  switch (condition.kind) {
    case "AtomicCondition": {
      const assertion = condition.assertion;
      if (assertion?.subject?.kind === "NounPhrase" && isUniversalNounPhrase(assertion.subject)) {
        const basePlan = compileNP(assertion.subject, state);
        const satisfyPlan = compileCondition(condition, Plans.allEntities(), state);
        const baseSet = executeSet(basePlan, state.kb.kb);
        const satisfySet = executeSet(satisfyPlan, state.kb.kb);
        return baseSet.andNot(satisfySet).isEmpty();
      }
      const plan = compileCondition(condition, Plans.allEntities(), state);
      return !executeSet(plan, state.kb.kb).isEmpty();
    }
    case "AndChain":
      return condition.items.every((item) => evaluateCondition(item, state));
    case "OrChain":
      return condition.items.some((item) => evaluateCondition(item, state));
    case "EitherOr":
      return evaluateCondition(condition.left, state) || evaluateCondition(condition.right, state);
    case "BothAnd":
      return evaluateCondition(condition.left, state) && evaluateCondition(condition.right, state);
    case "CaseScope":
      if (condition.mode === "negative") {
        return !evaluateCondition(condition.operand, state);
      }
      return evaluateCondition(condition.operand, state);
    case "GroupCondition":
      return evaluateCondition(condition.inner, state);
    default:
      return false;
  }
}
