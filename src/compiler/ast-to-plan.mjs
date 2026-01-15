import { Plans } from "../plans/ir.mjs";
import { ConceptKind } from "../ids/interners.mjs";
import {
  canonicalEntityKey,
  canonicalAttributeKey,
  canonicalAttributeKeyFromSelector,
} from "./canonical-keys.mjs";

function resolveEntityId(node, context) {
  if (!node || !context?.idStore) return null;
  const key = canonicalEntityKey(node);
  if (!key) return null;
  const conceptId = context.idStore.internConcept(ConceptKind.Entity, key);
  return context.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

function resolveUnaryIdFromCore(coreWords, context) {
  if (!context?.idStore || coreWords.length === 0) return null;
  const key = `U:${coreWords.join(" ")}`;
  const conceptId = context.idStore.internConcept(ConceptKind.UnaryPredicate, key);
  return context.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
}

function resolvePredicateId(verbKey, context) {
  if (!verbKey || !context?.idStore) return null;
  const conceptId = context.idStore.internConcept(ConceptKind.Predicate, verbKey);
  return context.idStore.getDenseId(ConceptKind.Predicate, conceptId);
}

function resolveAttributeId(attrKey, context) {
  if (!attrKey || !context?.idStore) return null;
  const conceptId = context.idStore.internConcept(ConceptKind.Attribute, attrKey);
  return context.idStore.getDenseId(ConceptKind.Attribute, conceptId);
}

function normalizeComparatorLiteral(op) {
  const raw = String(op).toLowerCase().trim();
  switch (raw) {
    case "greaterthan":
    case "greater than":
      return "greater than";
    case "lessthan":
    case "less than":
      return "less than";
    case "equalto":
    case "equal to":
      return "equal to";
    case "notequalto":
    case "not equal to":
      return "not equal to";
    case "greaterthanorequalto":
    case "greater than or equal to":
      return "greater than or equal to";
    case "lessthanorequalto":
    case "less than or equal to":
      return "less than or equal to";
    case "contains":
      return "contains";
    case "notcontains":
    case "does not contain":
      return "does not contain";
    default:
      return raw;
  }
}

function recordError(context, code, message, token) {
  if (!context?.errors) return;
  context.errors.push({
    code,
    name: "CompilerError",
    message,
    severity: "error",
    primaryToken: token ?? "EOF",
    hint: "Check BaseDictionary declarations.",
  });
}

function checkAttributeComparator(attrKey, comparator, context) {
  if (!context?.dictionary || !attrKey || !context.validateDictionary) return;
  const key = attrKey.replace(/^A:/, "");
  const attrDef = context.dictionary.attributes.get(key);
  if (!attrDef || attrDef.comparators.size === 0) return;
  const normalized = normalizeComparatorLiteral(comparator);
  if (!attrDef.comparators.has(normalized)) {
    recordError(context, "CMP012", "Comparator not allowed for attribute.", key);
  }
}

function checkAttributeNumeric(attrKey, context) {
  if (!context?.dictionary || !attrKey || !context.validateDictionary) return;
  const key = attrKey.replace(/^A:/, "");
  const attrDef = context.dictionary.attributes.get(key);
  if (!attrDef) return;
  if (attrDef.valueType && attrDef.valueType !== "numeric") {
    recordError(context, "CMP016", "Comparator requires numeric attribute.", key);
  }
}

function checkAttributeEntity(attrKey, context) {
  if (!context?.dictionary || !attrKey || !context.validateDictionary) return;
  const key = attrKey.replace(/^A:/, "");
  const attrDef = context.dictionary.attributes.get(key);
  if (!attrDef) return;
  if (attrDef.valueType && attrDef.valueType !== "entity") {
    recordError(context, "CMP017", "Entity filter requires entity-valued attribute.", key);
  }
}

function verbGroupKey(verbGroup, { negated } = {}) {
  if (!verbGroup) return null;
  const parts = [];
  if (verbGroup.auxiliary) parts.push(`aux:${verbGroup.auxiliary}`);
  parts.push(verbGroup.verb);
  verbGroup.particles.forEach((particle) => parts.push(particle));
  const base = `P:${parts.join("|")}`;
  if (!negated) return base;
  return base.replace(/^P:/, "P:not|");
}

function passiveKey(verb, preposition, { negated } = {}) {
  const base = `P:passive:${verb}|${preposition}`;
  if (!negated) return base;
  return base.replace(/^P:/, "P:not|");
}

function unaryKeyFromComplement(complement) {
  if (!complement) return null;
  if (complement.kind === "Name") return [complement.value];
  if (complement.kind === "NounPhrase") return complement.core;
  return null;
}

function resolveUnaryIdFromCoreWithNegation(coreWords, { negated } = {}, context) {
  if (!coreWords || coreWords.length === 0) return null;
  const key = negated ? `U:not|${coreWords.join(" ")}` : `U:${coreWords.join(" ")}`;
  const conceptId = context.idStore.internConcept(ConceptKind.UnaryPredicate, key);
  return context.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
}

function attributeKeyFromSelector(selector) {
  return canonicalAttributeKeyFromSelector(selector);
}

function objectToSetPlan(node, context) {
  if (!node) return Plans.allEntities();
  if (node.kind === "Variable") {
    recordError(context, "CMP019", "Variables are not supported in this context.", `?${node.name}`);
    return Plans.allEntities();
  }
  if (node.kind === "NounPhrase") return compileNP(node, context);
  const entityId = resolveEntityId(node, context);
  if (entityId === null) return Plans.allEntities();
  return Plans.entitySet(entityId);
}

function compileRelativeClause(node, context) {
  if (!node) return Plans.allEntities();
  if (node.kind === "RelativeAndChain") {
    return Plans.intersect(node.items.map((item) => compileRelativeClause(item, context)));
  }
  if (node.kind === "RelativeOrChain") {
    return Plans.union(node.items.map((item) => compileRelativeClause(item, context)));
  }
  if (node.kind !== "RelativeClause") return Plans.allEntities();

  const body = node.body;
  if (!body) return Plans.allEntities();

  switch (body.kind) {
    case "RelActiveRelation": {
      const predId = resolvePredicateId(verbGroupKey(body.verbGroup), context);
      if (predId === null) return Plans.allEntities();
      return Plans.preimage(predId, objectToSetPlan(body.object, context));
    }
    case "RelPassiveRelation": {
      const predId = resolvePredicateId(passiveKey(body.verb, body.preposition, { negated: body.negated }), context);
      if (predId === null) return Plans.allEntities();
      return Plans.preimage(predId, objectToSetPlan(body.object, context));
    }
    case "RelCopulaPredicate": {
      const unaryCore = unaryKeyFromComplement(body.complement);
      if (!unaryCore) return Plans.allEntities();
      const unaryId = resolveUnaryIdFromCoreWithNegation(unaryCore, { negated: body.negated }, context);
      return unaryId === null ? Plans.allEntities() : Plans.unarySet(unaryId);
    }
    case "RelAttributeLike": {
      const attrKey = attributeKeyFromSelector(body.attribute);
      const attrId = resolveAttributeId(attrKey, context);
      if (attrId === null) return Plans.allEntities();
      const predicate = body.predicate;
      if (predicate && predicate.kind === "RelPredicateComparison") {
        const right = predicate.right;
        if (right.kind === "NumberLiteral") {
          checkAttributeNumeric(attrKey, context);
          checkAttributeComparator(attrKey, predicate.comparator.op, context);
          return Plans.numFilter(attrId, predicate.comparator.op, right.value);
        }
        checkAttributeEntity(attrKey, context);
        return Plans.attrEntityFilter(attrId, objectToSetPlan(right, context));
      }
      return Plans.allEntities();
    }
    case "RelComparison":
      return Plans.allEntities();
    default:
      return Plans.allEntities();
  }
}

export function compileNP(node, context) {
  if (!node) return Plans.allEntities();
  if (node.kind === "Variable") {
    recordError(context, "CMP019", "Variables are not supported in this context.", `?${node.name}`);
    return Plans.allEntities();
  }
  if (node.kind === "Name") {
    const entityId = resolveEntityId(node, context);
    return entityId === null ? Plans.allEntities() : Plans.entitySet(entityId);
  }
  if (node.kind !== "NounPhrase") return Plans.allEntities();

  let baseSet = Plans.allEntities();
  if (node.core && node.core.length > 0) {
    const unaryId = resolveUnaryIdFromCore(node.core, context);
    if (unaryId !== null) baseSet = Plans.unarySet(unaryId);
  }

  if (!node.relative) return baseSet;
  const relPlan = compileRelativeClause(node.relative, context);
  return Plans.intersect([baseSet, relPlan]);
}

function compileAssertionToSetPlan(assertion, context) {
  if (!assertion) return Plans.allEntities();
  const subjectPlan = assertion.subject ? compileNP(assertion.subject, context) : Plans.allEntities();

  switch (assertion.kind) {
    case "ActiveRelationAssertion": {
      const predId = resolvePredicateId(verbGroupKey(assertion.verbGroup, { negated: assertion.negated }), context);
      if (predId === null) return subjectPlan;
      const objectPlan = objectToSetPlan(assertion.object, context);
      return Plans.intersect([subjectPlan, Plans.preimage(predId, objectPlan)]);
    }
    case "PassiveRelationAssertion": {
      const predId = resolvePredicateId(
        passiveKey(assertion.verb, assertion.preposition, { negated: assertion.negated }),
        context,
      );
      if (predId === null) return subjectPlan;
      const objectPlan = objectToSetPlan(assertion.object, context);
      return Plans.intersect([subjectPlan, Plans.preimage(predId, objectPlan)]);
    }
    case "CopulaPredicateAssertion": {
      const unaryCore = unaryKeyFromComplement(assertion.complement);
      if (!unaryCore) return subjectPlan;
      const unaryId = resolveUnaryIdFromCoreWithNegation(unaryCore, { negated: assertion.negated }, context);
      if (unaryId === null) return subjectPlan;
      return Plans.intersect([subjectPlan, Plans.unarySet(unaryId)]);
    }
    case "AttributeAssertion": {
      const attrKey = canonicalAttributeKey(assertion.attribute);
      const attrId = resolveAttributeId(attrKey, context);
      if (attrId === null || !assertion.value) return subjectPlan;
      const value = assertion.value;
      let filter = null;
      if (value.kind === "NumberLiteral") {
        checkAttributeNumeric(attrKey, context);
        filter = Plans.numFilter(attrId, "eq", value.value);
      } else {
        checkAttributeEntity(attrKey, context);
        filter = Plans.attrEntityFilter(attrId, objectToSetPlan(value, context));
      }
      return Plans.intersect([subjectPlan, filter]);
    }
    case "ComparisonAssertion": {
      const left = assertion.left;
      const right = assertion.right;
      const attrKey = left?.kind === "Name" ? `A:${left.value}` : null;
      const attrId = resolveAttributeId(attrKey, context);
      if (attrId === null || right.kind !== "NumberLiteral") return subjectPlan;
      checkAttributeNumeric(attrKey, context);
      checkAttributeComparator(attrKey, assertion.comparator.op, context);
      const filter = Plans.numFilter(attrId, assertion.comparator.op, right.value);
      return Plans.intersect([subjectPlan, filter]);
    }
    default:
      return subjectPlan;
  }
}

export function compileCondition(node, universePlan, context) {
  if (!node) return universePlan ?? Plans.allEntities();

  switch (node.kind) {
    case "AtomicCondition":
      return compileAssertionToSetPlan(node.assertion, context);
    case "AndChain":
      return Plans.intersect(node.items.map((item) => compileCondition(item, universePlan, context)));
    case "OrChain":
      return Plans.union(node.items.map((item) => compileCondition(item, universePlan, context)));
    case "EitherOr":
      return Plans.union([
        compileCondition(node.left, universePlan, context),
        compileCondition(node.right, universePlan, context),
      ]);
    case "BothAnd":
      return Plans.intersect([
        compileCondition(node.left, universePlan, context),
        compileCondition(node.right, universePlan, context),
      ]);
    case "CaseScope":
      if (node.mode === "negative") {
        return Plans.not(compileCondition(node.operand, universePlan, context), universePlan);
      }
      return compileCondition(node.operand, universePlan, context);
    case "GroupCondition":
      return compileCondition(node.inner, universePlan, context);
    default:
      return universePlan ?? Plans.allEntities();
  }
}

export function compileRuleBody(node, context) {
  return compileCondition(node, Plans.allEntities(), context);
}

export function compileRuleHead(node, context) {
  if (!node) return null;
  if (node.kind === "AssertionSentence") {
    return compileEmitFromAssertion(node.assertion, context);
  }
  if (node.kind === "BecauseSentence") {
    return compileEmitFromAssertion(node.assertion, context);
  }
  return null;
}

function compileEmitFromAssertion(assertion, context) {
  if (!assertion) return null;
  const subjectPlan = assertion.subject ? compileNP(assertion.subject, context) : null;
  switch (assertion.kind) {
    case "CopulaPredicateAssertion": {
      const unaryCore = unaryKeyFromComplement(assertion.complement);
      if (!unaryCore) return null;
      const unaryId = resolveUnaryIdFromCoreWithNegation(unaryCore, { negated: assertion.negated }, context);
      if (unaryId === null) return null;
      return { kind: "UnaryEmit", unaryId, subjectPlan };
    }
    case "ActiveRelationAssertion": {
      const predId = resolvePredicateId(verbGroupKey(assertion.verbGroup, { negated: assertion.negated }), context);
      if (predId === null) return null;
      return {
        kind: "BinaryEmit",
        predId,
        objectSet: objectToSetPlan(assertion.object, context),
        subjectPlan,
      };
    }
    case "PassiveRelationAssertion": {
      const predId = resolvePredicateId(
        passiveKey(assertion.verb, assertion.preposition, { negated: assertion.negated }),
        context,
      );
      if (predId === null) return null;
      return {
        kind: "BinaryEmit",
        predId,
        objectSet: objectToSetPlan(assertion.object, context),
        subjectPlan,
      };
    }
    case "AttributeAssertion": {
      const attrKey = canonicalAttributeKey(assertion.attribute);
      const attrId = resolveAttributeId(attrKey, context);
      if (attrId === null || !assertion.value) return null;
      const value = assertion.value;
      if (value.kind === "NumberLiteral") {
        return { kind: "AttrEmit", attrId, valueType: "numeric", value: value.value, subjectPlan };
      }
      let projectPredId = null;
      if (context?.projectEntityAttributes && attrKey) {
        const dictionaryKey = attrKey.replace(/^A:/, "");
        projectPredId = resolvePredicateId(`P:has_attr|${dictionaryKey}`, context);
      }
      return {
        kind: "AttrEmit",
        attrId,
        valueType: "entity",
        valueSet: objectToSetPlan(value, context),
        subjectPlan,
        projectPredId,
      };
    }
    default:
      return null;
  }
}

export function compileCommand(node, context) {
  if (!node) return null;
  switch (node.kind) {
    case "ReturnCommand":
      return { kind: "ReturnPlan", set: compileNP(node.expr, context), expr: node.expr };
    case "VerifyCommand":
      return { kind: "VerifyPlan", condition: compileCondition(node.proposition, Plans.allEntities(), context) };
    case "ExplainCommand":
      return { kind: "ExplainPlan", condition: compileCondition(node.proposition, Plans.allEntities(), context) };
    case "FindCommand": {
      const base = compileNP(node.expr, context);
      const constraint = compileCondition(node.constraint, Plans.allEntities(), context);
      return { kind: "FindPlan", set: Plans.intersect([base, constraint]), expr: node.expr };
    }
    case "SolveCommand": {
      if (node.variables && node.variables.length > 0) {
        return { kind: "SolvePlan", variables: node.variables, constraint: node.constraint, expr: node.expr };
      }
      const base = compileNP(node.expr, context);
      if (!node.constraint) {
        return { kind: "SolvePlan", set: base, expr: node.expr };
      }
      const constraint = compileCondition(node.constraint, Plans.allEntities(), context);
      return { kind: "SolvePlan", set: Plans.intersect([base, constraint]), expr: node.expr };
    }
    case "PlanCommand":
      return { kind: "PlanCommandPlan", condition: compileCondition(node.condition, Plans.allEntities(), context) };
    case "SimulateCommand":
      return { kind: "SimulatePlan", steps: node.steps };
    case "MaximizeCommand":
    case "MinimizeCommand":
      return {
        kind: node.kind === "MaximizeCommand" ? "MaximizePlan" : "MinimizePlan",
        constraint: compileCondition(node.constraint, Plans.allEntities(), context),
        objective: node.objective,
      };
    default:
      return { kind: "UnknownPlan", node };
  }
}
