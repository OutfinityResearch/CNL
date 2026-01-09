import { createIdStore, ConceptKind } from "../ids/interners.mjs";
import { createKB } from "../kb/kb.mjs";
import { createRuleStore } from "../rules/store.mjs";
import { createActionStore } from "../actions/store.mjs";
import { createFormulaStore } from "../formulas/store.mjs";
import { createJustificationStore } from "../provenance/justifications.mjs";
import { createDictionaryState, applyDictionaryStatement } from "./dictionary.mjs";
import { compileRuleBody, compileRuleHead, compileCommand } from "./ast-to-plan.mjs";
import { canonicalEntityKey, canonicalAttributeKey } from "./canonical-keys.mjs";

function createError(code, message, primaryToken) {
  return {
    code,
    name: "CompilerError",
    message,
    severity: "error",
    primaryToken: primaryToken ?? "EOF",
    hint: "Check compiler contract and BaseDictionary declarations.",
  };
}

function canonicalUnaryKey(node) {
  if (!node) return null;
  if (node.kind === "Name") return `U:${node.value}`;
  if (node.kind === "NounPhrase") return `U:${node.core.join(" ")}`;
  return null;
}

function canonicalVerbKey(verbGroup) {
  if (!verbGroup) return null;
  const parts = [];
  if (verbGroup.auxiliary) {
    parts.push(`aux:${verbGroup.auxiliary}`);
  }
  parts.push(verbGroup.verb);
  verbGroup.particles.forEach((particle) => parts.push(particle));
  return `P:${parts.join("|")}`;
}

function canonicalPassiveKey(verb, preposition) {
  return `P:passive:${verb}|${preposition}`;
}

function dictionaryPredicateKeyFromVerb(key) {
  if (!key) return null;
  return key.replace(/^P:/, "");
}

function dictionaryUnaryKeyFromComplement(complement) {
  if (!complement) return null;
  if (complement.kind === "Name") return complement.value;
  if (complement.kind === "NounPhrase") return complement.core.join(" ");
  return null;
}

function normalizeComparatorLiteral(op) {
  const raw = String(op).toLowerCase().trim();
  switch (raw) {
    case "greaterthan":
    case "greater_than":
    case "greater than":
      return "greater than";
    case "lessthan":
    case "less_than":
    case "lessthanorequalto":
    case "less than":
      return "less than";
    case "equalto":
    case "equal to":
      return "equal to";
    case "notequalto":
    case "not equal to":
      return "not equal to";
    case "contains":
      return "contains";
    case "notcontains":
    case "does not contain":
      return "does not contain";
    case "greaterthanorequalto":
    case "greater than or equal to":
      return "greater than or equal to";
    case "lessthanorequalto":
    case "less than or equal to":
      return "less than or equal to";
    default:
      return raw.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }
}

function checkDictionaryComparator(attrDef, comparator, state, attrKey) {
  if (!state.validateDictionary) return;
  if (!attrDef || attrDef.comparators.size === 0) return;
  const normalized = normalizeComparatorLiteral(comparator);
  if (!attrDef.comparators.has(normalized)) {
    state.errors.push(
      createError("CMP012", "Comparator not allowed for attribute.", attrKey)
    );
  }
}

function hasTypeMembership(state, entityId, typeKey) {
  const unaryKey = `U:${typeKey}`;
  const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, unaryKey);
  const unaryId = state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
  const set = state.kb.kb.unaryIndex[unaryId];
  return Boolean(set && set.hasBit(entityId));
}

function validateDomainRange(state, predDef, subjectId, objectId) {
  if (!state.validateDictionary) return;
  if (!predDef) return;
  const domain = predDef.domain ?? [];
  const range = predDef.range ?? [];

  if (domain.length > 0) {
    const anyKnown = domain.some((typeKey) => {
      const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, `U:${typeKey}`);
      const unaryId = state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
      const set = state.kb.kb.unaryIndex[unaryId];
      return set && !set.isEmpty();
    });
    if (anyKnown && !domain.some((typeKey) => hasTypeMembership(state, subjectId, typeKey))) {
      state.errors.push(createError("CMP013", "Domain constraint violated.", predDef.key));
    }
  }

  if (range.length > 0) {
    const anyKnown = range.some((typeKey) => {
      const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, `U:${typeKey}`);
      const unaryId = state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
      const set = state.kb.kb.unaryIndex[unaryId];
      return set && !set.isEmpty();
    });
    if (anyKnown && !range.some((typeKey) => hasTypeMembership(state, objectId, typeKey))) {
      state.errors.push(createError("CMP014", "Range constraint violated.", predDef.key));
    }
  }
}

function resolveEntityId(node, state) {
  const key = canonicalEntityKey(node);
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Entity, key);
  return state.idStore.getDenseId(ConceptKind.Entity, conceptId);
}

function resolveUnaryId(node, state) {
  const key = canonicalUnaryKey(node);
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.UnaryPredicate, key);
  return state.idStore.getDenseId(ConceptKind.UnaryPredicate, conceptId);
}

function resolvePredId(key, state) {
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Predicate, key);
  return state.idStore.getDenseId(ConceptKind.Predicate, conceptId);
}

function resolveAttrId(key, state) {
  if (!key) return null;
  const conceptId = state.idStore.internConcept(ConceptKind.Attribute, key);
  return state.idStore.getDenseId(ConceptKind.Attribute, conceptId);
}

function handleAttributeAssertion(assertion, state, options) {
  const subjectId = resolveEntityId(assertion.subject, state);
  if (subjectId === null) {
    state.errors.push(createError("CMP001", "Non-ground attribute subject.", "subject"));
    return;
  }

  const attrKey = canonicalAttributeKey(assertion.attribute);
  const attrId = resolveAttrId(attrKey, state);
  if (attrId === null) {
    state.errors.push(createError("CMP002", "Invalid attribute key.", "attribute"));
    return;
  }

  const value = assertion.value;
  const dictionaryKey = attrKey.replace(/^A:/, "");
  const attrDef = state.dictionary.attributes.get(dictionaryKey);

  if (value && value.kind === "NumberLiteral") {
    if (state.validateDictionary && attrDef && attrDef.valueType && attrDef.valueType !== "numeric") {
      state.errors.push(createError("CMP003", "Attribute expects entity value.", attrKey));
      return;
    }
    state.kb.setNumeric(attrId, subjectId, value.value);
    return;
  }

  if (!value) {
    state.errors.push(createError("CMP004", "Attribute value is required.", attrKey));
    return;
  }

  if (state.validateDictionary && attrDef && attrDef.valueType && attrDef.valueType !== "entity") {
    state.errors.push(createError("CMP003", "Attribute expects numeric value.", attrKey));
    return;
  }

  if (state.validateDictionary && !attrDef && value.kind !== "NumberLiteral") {
    state.errors.push(createError("CMP005", "Non-numeric attribute without dictionary.", attrKey));
    return;
  }

  const entityId = resolveEntityId(value, state);
  if (entityId === null) {
    state.errors.push(createError("CMP006", "Non-ground attribute value.", attrKey));
    return;
  }

  let projectPredId = null;
  if (options.projectEntityAttributes) {
    const derivedKey = `P:has_attr|${dictionaryKey}`;
    projectPredId = resolvePredId(derivedKey, state);
  }

  state.kb.insertEntityAttr(attrId, subjectId, entityId, { projectPredId });
}

function handleAssertion(assertion, state, options) {
  switch (assertion.kind) {
    case "ActiveRelationAssertion": {
      const subjectId = resolveEntityId(assertion.subject, state);
      const objectId = resolveEntityId(assertion.object, state);
      if (subjectId === null || objectId === null) {
        state.errors.push(createError("CMP007", "Non-ground relation assertion.", "assertion"));
        return;
      }
      const predKey = canonicalVerbKey(assertion.verbGroup);
      const predId = resolvePredId(predKey, state);
      if (state.validateDictionary) {
        const dictKey = dictionaryPredicateKeyFromVerb(predKey);
        const predDef = state.dictionary.predicates.get(dictKey);
        if (predDef && predDef.arity && predDef.arity !== "binary") {
          state.errors.push(createError("CMP015", "Predicate arity mismatch.", dictKey));
          return;
        }
        validateDomainRange(state, predDef, subjectId, objectId);
      }
      state.kb.insertBinary(subjectId, predId, objectId);
      return;
    }
    case "PassiveRelationAssertion": {
      const subjectId = resolveEntityId(assertion.subject, state);
      const objectId = resolveEntityId(assertion.object, state);
      if (subjectId === null || objectId === null) {
        state.errors.push(createError("CMP007", "Non-ground relation assertion.", "assertion"));
        return;
      }
      const predKey = canonicalPassiveKey(assertion.verb, assertion.preposition);
      const predId = resolvePredId(predKey, state);
      if (state.validateDictionary) {
        const dictKey = dictionaryPredicateKeyFromVerb(predKey);
        const predDef = state.dictionary.predicates.get(dictKey);
        if (predDef && predDef.arity && predDef.arity !== "binary") {
          state.errors.push(createError("CMP015", "Predicate arity mismatch.", dictKey));
          return;
        }
        validateDomainRange(state, predDef, subjectId, objectId);
      }
      state.kb.insertBinary(subjectId, predId, objectId);
      return;
    }
    case "CopulaPredicateAssertion": {
      const subjectId = resolveEntityId(assertion.subject, state);
      if (subjectId === null) {
        state.errors.push(createError("CMP008", "Non-ground copula subject.", "subject"));
        return;
      }
      if (state.validateDictionary) {
        const unaryKey = dictionaryUnaryKeyFromComplement(assertion.complement);
        if (unaryKey) {
          const predDef = state.dictionary.predicates.get(unaryKey);
          if (predDef && predDef.arity && predDef.arity !== "unary") {
            state.errors.push(createError("CMP015", "Predicate arity mismatch.", unaryKey));
            return;
          }
        }
      }
      const unaryId = resolveUnaryId(assertion.complement, state);
      if (unaryId === null) {
        state.errors.push(createError("CMP009", "Invalid copula complement.", "complement"));
        return;
      }
      state.kb.insertUnary(unaryId, subjectId);
      return;
    }
    case "AttributeAssertion":
      handleAttributeAssertion(assertion, state, options);
      return;
    case "ComparisonAssertion": {
      if (state.validateDictionary && assertion.left?.kind === "Name") {
        const attrDef = state.dictionary.attributes.get(assertion.left.value);
        if (attrDef) {
          if (attrDef.valueType && attrDef.valueType !== "numeric") {
            state.errors.push(createError("CMP016", "Comparator requires numeric attribute.", assertion.left.value));
            return;
          }
          checkDictionaryComparator(attrDef, assertion.comparator.op, state, assertion.left.value);
        }
      }
      state.formulaStore.addFormula({ kind: "Comparison", ...assertion });
      return;
    }
    default:
      state.errors.push(createError("CMP000", "Unsupported assertion.", assertion.kind));
  }
}

function compileSentence(sentence, state, options) {
  if (!sentence) return;
  if (sentence.kind === "AssertionSentence") {
    handleAssertion(sentence.assertion, state, options);
    return;
  }
  if (sentence.kind === "BecauseSentence") {
    handleAssertion(sentence.assertion, state, options);
    return;
  }
  if (sentence.kind === "ConditionalSentence") {
    const plan = compileRuleBody(sentence.condition, state);
    const head = compileRuleHead(sentence.then, state);
    state.ruleStore.addRule({ kind: "RulePlan", body: plan, head });
  }
}

export function createCompilerState(options = {}) {
  return {
    idStore: options.idStore ?? createIdStore(),
    kb: options.kb ?? createKB(options),
    dictionary: options.dictionary ?? createDictionaryState(),
    ruleStore: options.ruleStore ?? createRuleStore(),
    actionStore: options.actionStore ?? createActionStore(),
    formulaStore: options.formulaStore ?? createFormulaStore(),
    commandStore: options.commandStore ?? [],
    justificationStore: options.justificationStore ?? createJustificationStore(),
    errors: [],
    validateDictionary: options.validateDictionary ?? true,
    projectEntityAttributes: options.projectEntityAttributes ?? false,
  };
}

export function compileProgram(ast, options = {}) {
  const state = options.state ?? createCompilerState(options);
  const projectEntityAttributes = options.projectEntityAttributes ?? state.projectEntityAttributes ?? false;
  let currentContext = null;

  if (!ast || ast.kind !== "Program") {
    state.errors.push(createError("CMP010", "Expected Program AST.", "Program"));
    return state;
  }

  for (const item of ast.items) {
    if (item.kind === "ContextDirective") {
      currentContext = item.name;
      continue;
    }

    if (currentContext === "BaseDictionary") {
      applyDictionaryStatement(item, state.dictionary);
      if (state.dictionary.errors.length > 0) {
        state.errors.push(...state.dictionary.errors);
        state.dictionary.errors.length = 0;
      }
      continue;
    }

    switch (item.kind) {
      case "Statement":
        compileSentence(item.sentence, state, { projectEntityAttributes });
        break;
      case "RuleStatement":
        if (item.sentence?.kind === "ConditionalSentence") {
          const plan = compileRuleBody(item.sentence.condition, state);
          const head = compileRuleHead(item.sentence.then, state);
          state.ruleStore.addRule({ kind: "RulePlan", body: plan, head });
        } else {
          state.ruleStore.addRule({ kind: "RuleAst", sentence: item.sentence });
        }
        break;
      case "CommandStatement":
        state.commandStore.push(compileCommand(item.command, state));
        break;
      case "ActionBlock":
        state.actionStore.addAction(item);
        break;
      case "TransitionRuleStatement":
        state.ruleStore.addRule({ kind: "TransitionRule", ...item });
        break;
      default:
        state.errors.push(createError("CMP011", "Unsupported program item.", item.kind));
    }
  }

  return state;
}
