import { executeSet, executeRelation } from "../plans/execute.mjs";

function applyUnaryEmit(emit, subjectSet, kbApi, options) {
  let added = 0;
  subjectSet.iterateSetBits((subjectId) => {
    if (kbApi.insertUnary(emit.unaryId, subjectId)) {
      added += 1;
      if (options?.justificationStore && Number.isInteger(options.ruleId)) {
        const factId = options.justificationStore.makeUnaryFactId(emit.unaryId, subjectId);
        options.justificationStore.addDerivedFact(factId, options.ruleId, []);
      }
    }
  });
  return added;
}

function applyBinaryEmit(emit, subjectSet, kbApi, options) {
  let added = 0;
  const objectSet = executeSet(emit.objectSet, kbApi.kb);
  subjectSet.iterateSetBits((subjectId) => {
    objectSet.iterateSetBits((objectId) => {
      if (kbApi.insertBinary(subjectId, emit.predId, objectId)) {
        added += 1;
        if (options?.justificationStore && Number.isInteger(options.ruleId)) {
          const factId = options.justificationStore.makeFactId(emit.predId, subjectId, objectId);
          options.justificationStore.addDerivedFact(factId, options.ruleId, []);
        }
      }
    });
  });
  return added;
}

function applyAttrEmit(emit, subjectSet, kbApi) {
  let added = 0;
  if (emit.valueType === "numeric") {
    subjectSet.iterateSetBits((subjectId) => {
      kbApi.setNumeric(emit.attrId, subjectId, emit.value);
      added += 1;
    });
    return added;
  }
  if (emit.valueType === "entity") {
    const valueSet = executeSet(emit.valueSet, kbApi.kb);
    const projectPredId = Number.isInteger(emit.projectPredId) ? emit.projectPredId : null;
    subjectSet.iterateSetBits((subjectId) => {
      valueSet.iterateSetBits((entityId) => {
        kbApi.insertEntityAttr(emit.attrId, subjectId, entityId, { projectPredId });
        added += 1;
      });
    });
  }
  return added;
}

function applyRule(rule, kbApi, options) {
  if (!rule || rule.kind !== "RulePlan") return 0;
  const bodySet = executeSet(rule.body, kbApi.kb);
  if (!rule.head) return 0;

  let subjectSet = bodySet;
  if (rule.head.subjectPlan) {
    const subjectPlanSet = executeSet(rule.head.subjectPlan, kbApi.kb);
    subjectSet = subjectPlanSet.and(bodySet);
  }

  switch (rule.head.kind) {
    case "UnaryEmit":
      return applyUnaryEmit(rule.head, subjectSet, kbApi, options);
    case "BinaryEmit":
      return applyBinaryEmit(rule.head, subjectSet, kbApi, options);
    case "AttrEmit":
      return applyAttrEmit(rule.head, subjectSet, kbApi);
    default:
      return 0;
  }
}

export function createRuleStore() {
  const rules = [];

  function addRule(plan) {
    const id = rules.length;
    rules.push(plan);
    return id;
  }

  function getRules() {
    return rules.slice();
  }

  function applyRules(kbApi, options = {}) {
    let totalAdded = 0;
    for (let i = 0; i < rules.length; i += 1) {
      totalAdded += applyRule(rules[i], kbApi, { ...options, ruleId: i });
    }
    return totalAdded;
  }

  return {
    addRule,
    getRules,
    applyRules,
  };
}
