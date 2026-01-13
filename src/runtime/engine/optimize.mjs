import { Plans } from "../../plans/ir.mjs";
import { executeNumber } from "../../plans/execute.mjs";
import { compileNP } from "../../compiler/ast-to-plan.mjs";
import { canonicalAttributeKeyFromSelector } from "../../compiler/canonical-keys.mjs";
import { ConceptKind } from "../../ids/interners.mjs";

export function evaluateAggregation(expr, state) {
  if (!expr || expr.kind !== "AggregationExpr") return Number.NaN;
  const setPlan = compileNP(expr.set, state);
  if (expr.agg === "NumberOf") {
    return executeNumber(Plans.aggregate("NumberOf", setPlan), state.kb.kb);
  }
  const attrKey = canonicalAttributeKeyFromSelector(expr.attribute);
  if (!attrKey) return Number.NaN;
  const conceptId = state.idStore.internConcept(ConceptKind.Attribute, attrKey);
  const attrId = state.idStore.getDenseId(ConceptKind.Attribute, conceptId);
  return executeNumber(Plans.aggregate(expr.agg, setPlan, attrId), state.kb.kb);
}
