import { executeSet, executeRelation } from "../plans/execute.mjs";

function applyUnaryEmit(emit, subjectSet, kbApi) {
  let added = 0;
  subjectSet.iterateSetBits((subjectId) => {
    if (kbApi.insertUnary(emit.unaryId, subjectId)) {
      added += 1;
    }
  });
  return added;
}

function applyBinaryEmit(emit, subjectSet, kbApi) {
  let added = 0;
  const objectSet = executeSet(emit.objectSet, kbApi.kb);
  subjectSet.iterateSetBits((subjectId) => {
    objectSet.iterateSetBits((objectId) => {
      if (kbApi.insertBinary(subjectId, emit.predId, objectId)) {
        added += 1;
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
      return applyUnaryEmit(rule.head, subjectSet, kbApi);
    case "BinaryEmit":
      return applyBinaryEmit(rule.head, subjectSet, kbApi);
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
    for (const rule of rules) {
      totalAdded += applyRule(rule, kbApi, options);
    }
    return totalAdded;
  }

  return {
    addRule,
    getRules,
    applyRules,
  };
}
