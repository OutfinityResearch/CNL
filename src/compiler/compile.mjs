import { createIdStore, ConceptKind } from "../ids/interners.mjs";
import { createKB } from "../kb/kb.mjs";
import { createRuleStore } from "../rules/store.mjs";
import { createActionStore } from "../actions/store.mjs";
import { createFormulaStore } from "../formulas/store.mjs";
import { createJustificationStore } from "../provenance/justifications.mjs";
import { createDictionaryState, applyDictionaryStatement } from "./dictionary.mjs";
import { compileRuleBody, compileRuleHead, compileCommand } from "./ast-to-plan.mjs";

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

function canonicalEntityKey(node) {
  if (node.kind === "Name") return `E:${node.value}`;
  if (node.kind === "NumberLiteral") return `L:num:${node.value}`;
  if (node.kind === "StringLiteral") return `L:str:${node.value}`;
  if (node.kind === "BooleanLiteral") return `L:bool:${node.value}`;
  return null;
}

function canonicalUnaryKey(node) {
  if (!node) return null;
  if (node.kind === "Name") return `U:${node.value}`;
  if (node.kind === "NounPhrase") return `U:${node.core.join(" ")}`;
  return null;
}

function canonicalAttributeKey(attribute) {
  if (!attribute || attribute.kind !== "AttributeRef") return null;
  const core = attribute.core.join(" ");
  const pp = attribute.pp
    .map((item) => `${item.preposition}:${formatObject(item.object)}`)
    .join("|");
  if (!pp) return `A:${core}`;
  return `A:${core}|${pp}`;
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

function formatObject(node) {
  if (!node) return "";
  if (node.kind === "Name") return node.value;
  if (node.kind === "NounPhrase") return node.core.join(" ");
  if (node.kind === "NumberLiteral") return String(node.value);
  if (node.kind === "StringLiteral") return node.value;
  if (node.kind === "BooleanLiteral") return node.value ? "true" : "false";
  return node.kind;
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
    if (attrDef && attrDef.valueType && attrDef.valueType !== "numeric") {
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

  if (attrDef && attrDef.valueType && attrDef.valueType !== "entity") {
    state.errors.push(createError("CMP003", "Attribute expects numeric value.", attrKey));
    return;
  }

  if (!attrDef && value.kind !== "NumberLiteral") {
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
      state.kb.insertBinary(subjectId, predId, objectId);
      return;
    }
    case "CopulaPredicateAssertion": {
      const subjectId = resolveEntityId(assertion.subject, state);
      if (subjectId === null) {
        state.errors.push(createError("CMP008", "Non-ground copula subject.", "subject"));
        return;
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
    const head = compileRuleHead(sentence.then);
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
  };
}

export function compileProgram(ast, options = {}) {
  const state = options.state ?? createCompilerState(options);
  const projectEntityAttributes = options.projectEntityAttributes ?? false;
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
          const head = compileRuleHead(item.sentence.then);
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
