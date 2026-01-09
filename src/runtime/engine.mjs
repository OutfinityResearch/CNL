import { Plans } from "../plans/ir.mjs";
import { executeSet, executeNumber } from "../plans/execute.mjs";
import { compileCommand, compileCondition, compileNP } from "../compiler/ast-to-plan.mjs";
import { canonicalEntityKey, canonicalAttributeKeyFromSelector } from "../compiler/canonical-keys.mjs";
import { ConceptKind } from "../ids/interners.mjs";

function isUniversalNounPhrase(node) {
  if (!node || node.kind !== "NounPhrase") return false;
  const prefix = node.prefix;
  if (!prefix || prefix.kind !== "Quantifier") return false;
  return prefix.q === "every" || prefix.q === "all";
}

function resolveEntityId(node, state) {
  const key = canonicalEntityKey(node);
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Entity, key);
  return state.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

function resolveUnaryId(complement, state) {
  if (!complement) return null;
  if (complement.kind === "Name") {
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, `U:${complement.value}`);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  if (complement.kind === "NounPhrase") {
    const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, `U:${complement.core.join(" ")}`);
    return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  }
  return null;
}

function verbGroupKey(verbGroup) {
  if (!verbGroup) return null;
  const parts = [];
  if (verbGroup.auxiliary) parts.push(`aux:${verbGroup.auxiliary}`);
  parts.push(verbGroup.verb);
  verbGroup.particles.forEach((particle) => parts.push(particle));
  return `P:${parts.join("|")}`;
}

function passiveKey(verb, preposition) {
  return `P:passive:${verb}|${preposition}`;
}

function resolvePredId(assertion, state) {
  let key = null;
  if (assertion.kind === "ActiveRelationAssertion") {
    key = verbGroupKey(assertion.verbGroup);
  } else if (assertion.kind === "PassiveRelationAssertion") {
    key = passiveKey(assertion.verb, assertion.preposition);
  }
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Predicate, key);
  return state.idStore.getDenseId(ConceptKind.Predicate, conceptId);
}

function collectEntities(set, state) {
  const entities = [];
  set.iterateSetBits((entityId) => {
    const conceptId = state.idStore.getConceptualId(ConceptKind.Entity, entityId);
    const key = conceptId ? state.idStore.lookupKey(conceptId) : null;
    entities.push({ id: entityId, key });
  });
  return entities;
}

export function materializeRules(state, options = {}) {
  let totalAdded = 0;
  while (true) {
    const added = state.ruleStore.applyRules(state.kb, options);
    totalAdded += added;
    if (added === 0) break;
  }
  return totalAdded;
}

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
    default:
      return false;
  }
}

function evaluateAggregation(expr, state) {
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

function explainAssertion(assertion, state) {
  const store = state.justificationStore;
  if (!store) return { error: "No justification store available." };
  if (!assertion) return { error: "No assertion to explain." };

  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const unaryId = resolveUnaryId(assertion.complement, state);
    if (subjectId === null || unaryId === null) {
      return { error: "Explanation requires a ground unary assertion." };
    }
    const factId = store.makeUnaryFactId(unaryId, subjectId);
    const justification = store.getJustification(factId);
    return justification ? { kind: "ExplainResult", factId, justification } : { error: "No justification found." };
  }

  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    const predId = resolvePredId(assertion, state);
    if (subjectId === null || objectId === null || predId === null) {
      return { error: "Explanation requires a ground binary assertion." };
    }
    const factId = store.makeFactId(predId, subjectId, objectId);
    const justification = store.getJustification(factId);
    return justification ? { kind: "ExplainResult", factId, justification } : { error: "No justification found." };
  }

  return { error: "Explanation unsupported for this assertion type." };
}

export function executeCommandAst(command, state) {
  if (!command) return { error: "Missing command." };

  switch (command.kind) {
    case "ReturnCommand": {
      const plan = compileCommand(command, state);
      const set = executeSet(plan.set, state.kb.kb);
      return { kind: "QueryResult", entities: collectEntities(set, state) };
    }
    case "FindCommand": {
      const plan = compileCommand(command, state);
      const set = executeSet(plan.set, state.kb.kb);
      return { kind: "QueryResult", entities: collectEntities(set, state) };
    }
    case "VerifyCommand": {
      const ok = evaluateCondition(command.proposition, state);
      return { kind: "ProofResult", value: ok };
    }
    case "ExplainCommand": {
      if (command.proposition?.kind !== "AtomicCondition") {
        return { error: "Explain requires a single atomic condition." };
      }
      return explainAssertion(command.proposition.assertion, state);
    }
    case "PlanCommand": {
      const satisfied = evaluateCondition(command.condition, state);
      return { kind: "PlanResult", status: satisfied ? "satisfied" : "unsatisfied", steps: [] };
    }
    case "SimulateCommand": {
      const summary = {
        entities: state.kb.kb.entitiesCount,
        predicates: state.kb.kb.predicatesCount,
        unary: state.kb.kb.unaryCount,
      };
      const steps = Number.isInteger(command.steps) ? command.steps : 0;
      const states = Array.from({ length: Math.max(steps, 1) }, () => summary);
      return { kind: "SimulationResult", steps, states };
    }
    case "MaximizeCommand":
    case "MinimizeCommand": {
      const ok = evaluateCondition(command.constraint, state);
      if (!ok) {
        return { kind: "OptimizeResult", status: "unsatisfied", value: Number.NaN };
      }
      let value = Number.NaN;
      if (command.objective?.kind === "AggregationExpr") {
        value = evaluateAggregation(command.objective, state);
      } else if (command.objective?.kind === "NumberLiteral") {
        value = command.objective.value;
      }
      return { kind: "OptimizeResult", status: "ok", value };
    }
    default:
      return { error: `Unsupported command: ${command.kind}` };
  }
}

export function executeProgram(program) {
  void program;
  throw new Error("Not implemented");
}
