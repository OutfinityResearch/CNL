import { executeSet, executeRelation } from "../plans/execute.mjs";
import { SetOp } from "../plans/ir.mjs";

function applyUnaryEmit(emit, subjectSet, kbApi, options) {
  let added = 0;
  subjectSet.iterateSetBits((subjectId) => {
    if (kbApi.insertUnary(emit.unaryId, subjectId)) {
      added += 1;
      if (options?.justificationStore && Number.isInteger(options.ruleId)) {
        const factId = options.justificationStore.makeUnaryFactId(emit.unaryId, subjectId);
        const premiseIds = collectPremiseFactIds(options.ruleBody, subjectId, kbApi, options);
        options.justificationStore.addDerivedFact(factId, options.ruleId, premiseIds);
      }
      if (options?.deltaUnary instanceof Set) {
        options.deltaUnary.add(emit.unaryId);
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
          const premiseIds = collectPremiseFactIds(options.ruleBody, subjectId, kbApi, options);
          options.justificationStore.addDerivedFact(factId, options.ruleId, premiseIds);
        }
        if (options?.deltaPred instanceof Set) {
          options.deltaPred.add(emit.predId);
        }
      }
    });
  });
  return added;
}

function applyAttrEmit(emit, subjectSet, kbApi, options) {
  let added = 0;
  if (emit.valueType === "numeric") {
    subjectSet.iterateSetBits((subjectId) => {
      const kbState = kbApi.kb;
      const index = kbState.numericIndex[emit.attrId];
      const hadValue =
        index &&
        subjectId >= 0 &&
        subjectId < index.values.length &&
        subjectId < index.hasValue.size &&
        index.hasValue.hasBit(subjectId);
      const same = hadValue && index.values[subjectId] === emit.value;
      if (same) return;
      kbApi.setNumeric(emit.attrId, subjectId, emit.value);
      added += 1;

      if (options?.justificationStore && Number.isInteger(options.ruleId)) {
        const factId = options.justificationStore.makeNumericFactId(emit.attrId, subjectId, emit.value);
        const premiseIds = collectPremiseFactIds(options.ruleBody, subjectId, kbApi, options);
        options.justificationStore.addDerivedFact(factId, options.ruleId, premiseIds);
      }
      if (options?.deltaAttr instanceof Set) {
        options.deltaAttr.add(emit.attrId);
      }
    });
    return added;
  }
  if (emit.valueType === "entity") {
    const valueSet = executeSet(emit.valueSet, kbApi.kb);
    const projectPredId = Number.isInteger(emit.projectPredId) ? emit.projectPredId : null;
    subjectSet.iterateSetBits((subjectId) => {
      valueSet.iterateSetBits((entityId) => {
        const kbState = kbApi.kb;
        const index = kbState.entAttrIndex[emit.attrId];
        const row = index && subjectId >= 0 && subjectId < index.values.length ? index.values[subjectId] : null;
        const already = row && entityId >= 0 && entityId < row.size && row.hasBit(entityId);
        if (already) return;
        kbApi.insertEntityAttr(emit.attrId, subjectId, entityId, { projectPredId });
        added += 1;

        if (options?.justificationStore && Number.isInteger(options.ruleId)) {
          const factId = options.justificationStore.makeEntityAttrFactId(emit.attrId, subjectId, entityId);
          const premiseIds = collectPremiseFactIds(options.ruleBody, subjectId, kbApi, options);
          options.justificationStore.addDerivedFact(factId, options.ruleId, premiseIds);
        }
        if (options?.deltaAttr instanceof Set) {
          options.deltaAttr.add(emit.attrId);
        }
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
      return applyUnaryEmit(rule.head, subjectSet, kbApi, { ...options, ruleBody: rule.body });
    case "BinaryEmit":
      return applyBinaryEmit(rule.head, subjectSet, kbApi, { ...options, ruleBody: rule.body });
    case "AttrEmit":
      return applyAttrEmit(rule.head, subjectSet, kbApi, { ...options, ruleBody: rule.body });
    default:
      return 0;
  }
}

function intersectsDeps(deps, deltaUnary, deltaPred, deltaAttr) {
  if (!deps || (!deltaUnary && !deltaPred && !deltaAttr)) return true;
  if (deltaUnary && deps.unaryIds) {
    for (const id of deps.unaryIds) if (deltaUnary.has(id)) return true;
  }
  if (deltaPred && deps.predIds) {
    for (const id of deps.predIds) if (deltaPred.has(id)) return true;
  }
  if (deltaAttr && deps.attrIds) {
    for (const id of deps.attrIds) if (deltaAttr.has(id)) return true;
  }
  return false;
}

function collectDepsFromSetPlan(plan, deps) {
  if (!plan || plan.kind !== "SetPlan") return deps;
  switch (plan.op) {
    case SetOp.UnarySet:
      deps.unaryIds.add(plan.unaryId);
      return deps;
    case SetOp.Image:
    case SetOp.Preimage:
      deps.predIds.add(plan.predId);
      collectDepsFromSetPlan(plan.subjectSet, deps);
      collectDepsFromSetPlan(plan.objectSet, deps);
      return deps;
    case SetOp.Intersect:
    case SetOp.Union:
      (plan.plans ?? []).forEach((child) => collectDepsFromSetPlan(child, deps));
      return deps;
    case SetOp.Not:
      collectDepsFromSetPlan(plan.plan, deps);
      collectDepsFromSetPlan(plan.universe, deps);
      return deps;
    case SetOp.NumFilter:
      deps.attrIds.add(plan.attrId);
      return deps;
    case SetOp.AttrEntityFilter:
      deps.attrIds.add(plan.attrId);
      collectDepsFromSetPlan(plan.valueSet, deps);
      return deps;
    case SetOp.EntitySet:
    case SetOp.AllEntities:
    default:
      return deps;
  }
}

function computeRuleDeps(rule) {
  const deps = { unaryIds: new Set(), predIds: new Set(), attrIds: new Set() };
  collectDepsFromSetPlan(rule.body, deps);
  if (rule.head?.kind === "BinaryEmit") {
    deps.predIds.add(rule.head.predId);
    collectDepsFromSetPlan(rule.head.objectSet, deps);
  }
  if (rule.head?.kind === "AttrEmit") {
    deps.attrIds.add(rule.head.attrId);
    if (rule.head.valueType === "entity") {
      collectDepsFromSetPlan(rule.head.valueSet, deps);
    }
  }
  if (rule.head?.subjectPlan) {
    collectDepsFromSetPlan(rule.head.subjectPlan, deps);
  }
  return deps;
}

function collectPremiseFactIds(plan, subjectId, kbApi, options) {
  const kbState = kbApi?.kb;
  const store = options?.justificationStore;
  if (!plan || plan.kind !== "SetPlan" || !kbState || !store) return [];

  switch (plan.op) {
    case SetOp.UnarySet:
      return [store.makeUnaryFactId(plan.unaryId, subjectId)];
    case SetOp.Preimage: {
      const matrix = kbState.relations[plan.predId];
      if (!matrix) return [];
      const row = matrix.rows[subjectId];
      if (!row) return [];
      const objectCandidates = executeSet(plan.objectSet, kbState);
      const intersection = row.and(objectCandidates);
      let found = null;
      intersection.iterateSetBits((objectId) => {
        if (found === null) found = objectId;
      });
      if (found === null) return [];
      return [store.makeFactId(plan.predId, subjectId, found)];
    }
    case SetOp.Intersect: {
      const premiseIds = [];
      for (const child of plan.plans ?? []) {
        premiseIds.push(...collectPremiseFactIds(child, subjectId, kbApi, options));
      }
      return premiseIds;
    }
    case SetOp.Union: {
      const plans = plan.plans ?? [];
      for (const child of plans) {
        const set = executeSet(child, kbState);
        if (set.hasBit(subjectId)) {
          return collectPremiseFactIds(child, subjectId, kbApi, options);
        }
      }
      return [];
    }
    case SetOp.NumFilter: {
      const index = kbState.numericIndex[plan.attrId];
      if (!index) return [];
      if (subjectId < 0 || subjectId >= index.values.length) return [];
      if (subjectId < 0 || subjectId >= index.hasValue.size) return [];
      if (!index.hasValue.hasBit(subjectId)) return [];
      const value = index.values[subjectId];
      return [store.makeNumericFactId(plan.attrId, subjectId, value)];
    }
    case SetOp.AttrEntityFilter: {
      const index = kbState.entAttrIndex[plan.attrId];
      if (!index) return [];
      if (subjectId < 0 || subjectId >= index.values.length) return [];
      const row = index.values[subjectId];
      if (!row) return [];
      const valueSet = executeSet(plan.valueSet, kbState);
      const intersection = row.and(valueSet);
      let found = null;
      intersection.iterateSetBits((entityId) => {
        if (found === null) found = entityId;
      });
      if (found === null) return [];
      return [store.makeEntityAttrFactId(plan.attrId, subjectId, found)];
    }
    case SetOp.Not:
    case SetOp.EntitySet:
    case SetOp.Image:
    case SetOp.AllEntities:
    default:
      return [];
  }
}

export function createRuleStore() {
  const rules = [];

  function addRule(plan) {
    const id = rules.length;
    if (plan && plan.kind === "RulePlan") {
      plan.deps = computeRuleDeps(plan);
    }
    rules.push(plan);
    return id;
  }

  function getRules() {
    return rules.slice();
  }

  function applyRules(kbApi, options = {}) {
    if (options?.delta === true) {
      let totalAdded = 0;
      let deltaUnary = null; // null => run all rules on first iteration
      let deltaPred = null;
      let deltaAttr = null;

      while (true) {
        const nextDeltaUnary = new Set();
        const nextDeltaPred = new Set();
        const nextDeltaAttr = new Set();
        let addedThisRound = 0;

        for (let i = 0; i < rules.length; i += 1) {
          const rule = rules[i];
          if (deltaUnary !== null && !intersectsDeps(rule?.deps, deltaUnary, deltaPred, deltaAttr)) {
            continue;
          }
          addedThisRound += applyRule(rule, kbApi, {
            ...options,
            ruleId: i,
            deltaUnary: nextDeltaUnary,
            deltaPred: nextDeltaPred,
            deltaAttr: nextDeltaAttr,
          });
        }

        totalAdded += addedThisRound;
        if (addedThisRound === 0) break;
        deltaUnary = nextDeltaUnary;
        deltaPred = nextDeltaPred;
        deltaAttr = nextDeltaAttr;
      }

      return totalAdded;
    }

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
