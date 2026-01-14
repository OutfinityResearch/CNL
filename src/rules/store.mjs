import { executeSet, executeRelation } from "../plans/execute.mjs";
import { RelationOp, SetOp } from "../plans/ir.mjs";

function stableStringify(value) {
  const seen = new WeakSet();
  function sortKeys(obj) {
    if (!obj || typeof obj !== "object") return obj;
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const out = {};
    Object.keys(obj)
      .sort()
      .forEach((k) => {
        if (k === "deps" || k === "span") return;
        out[k] = sortKeys(obj[k]);
      });
    return out;
  }
  return JSON.stringify(sortKeys(value));
}

function signatureForSetPlan(plan) {
  if (!plan || plan.kind !== "SetPlan") return "set:null";
  switch (plan.op) {
    case SetOp.AllEntities:
      return "set:all";
    case SetOp.EntitySet:
      return `set:entity:${plan.entityId}`;
    case SetOp.UnarySet:
      return `set:unary:${plan.unaryId}`;
    case SetOp.Preimage:
      return `set:preimage:${plan.predId}:${signatureForSetPlan(plan.objectSet)}`;
    case SetOp.Image:
      return `set:image:${plan.predId}:${signatureForSetPlan(plan.subjectSet)}`;
    case SetOp.Intersect: {
      const parts = (plan.plans ?? []).map(signatureForSetPlan).sort();
      return `set:and:${parts.join("&")}`;
    }
    case SetOp.Union: {
      const parts = (plan.plans ?? []).map(signatureForSetPlan).sort();
      return `set:or:${parts.join("|")}`;
    }
    case SetOp.Not:
      return `set:not:${signatureForSetPlan(plan.plan)}:universe:${signatureForSetPlan(plan.universe)}`;
    case SetOp.NumFilter:
      return `set:num:${plan.attrId}:${plan.comparator}:${plan.value}`;
    case SetOp.AttrEntityFilter:
      return `set:attr:${plan.attrId}:${signatureForSetPlan(plan.valueSet)}`;
    default:
      return `set:${plan.op}:${stableStringify(plan)}`;
  }
}

function signatureForRelationPlan(plan) {
  if (!plan || plan.kind !== "RelationPlan") return "rel:null";
  switch (plan.op) {
    case RelationOp.BaseRelation:
      return `rel:base:${plan.predId}`;
    case RelationOp.InverseRelation:
      return `rel:inv:${plan.predId}`;
    case RelationOp.Compose:
      return `rel:compose:${signatureForRelationPlan(plan.left)}:${signatureForRelationPlan(plan.right)}`;
    case RelationOp.RestrictSubjects:
      return `rel:subj:${signatureForRelationPlan(plan.relation)}:${signatureForSetPlan(plan.subjectSet)}`;
    case RelationOp.RestrictObjects:
      return `rel:obj:${signatureForRelationPlan(plan.relation)}:${signatureForSetPlan(plan.objectSet)}`;
    default:
      return `rel:${plan.op}:${stableStringify(plan)}`;
  }
}

function signatureForRule(plan) {
  if (!plan || typeof plan !== "object") return null;
  if (plan.kind === "RulePlan") {
    const body = signatureForSetPlan(plan.body);
    const head = signatureForHead(plan.head);
    return `rule:${body}->${head}`;
  }
  if (plan.kind === "RelationRulePlan") {
    return `relrule:${signatureForRelationPlan(plan.relation)}->${plan.headPredId}`;
  }
  if (plan.kind === "TransitionRule") {
    const event = stableStringify(plan.event);
    const effect = stableStringify(plan.effect);
    return `transition:${event}->${effect}`;
  }
  return null;
}

function signatureForHead(head) {
  if (!head || typeof head !== "object") return "head:null";
  if (head.kind === "UnaryEmit") {
    const subj = head.subjectPlan ? signatureForSetPlan(head.subjectPlan) : "subj:null";
    return `head:unary:${head.unaryId}:${subj}`;
  }
  if (head.kind === "BinaryEmit") {
    const subj = head.subjectPlan ? signatureForSetPlan(head.subjectPlan) : "subj:null";
    return `head:binary:${head.predId}:${signatureForSetPlan(head.objectSet)}:${subj}`;
  }
  if (head.kind === "AttrEmit") {
    const subj = head.subjectPlan ? signatureForSetPlan(head.subjectPlan) : "subj:null";
    if (head.valueType === "numeric") return `head:attr:${head.attrId}:num:${head.value}:${subj}`;
    if (head.valueType === "entity") return `head:attr:${head.attrId}:ent:${signatureForSetPlan(head.valueSet)}:${subj}`;
    return `head:attr:${head.attrId}:${head.valueType}:${subj}`;
  }
  return `head:${head.kind}:${stableStringify(head)}`;
}

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
  if (!rule) return 0;
  if (rule.kind === "RelationRulePlan") {
    return applyRelationRule(rule, kbApi, options);
  }
  if (rule.kind !== "RulePlan") return 0;
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

function iterRelationEdges(plan, kbState, callback) {
  if (!plan || plan.kind !== "RelationPlan") return;

  if (plan.op === RelationOp.BaseRelation || plan.op === RelationOp.InverseRelation) {
    const rel = executeRelation(plan, kbState);
    for (let subjectId = 0; subjectId < rel.rows.length; subjectId += 1) {
      rel.rows[subjectId].iterateSetBits((objectId) => callback(subjectId, objectId, null));
    }
    return;
  }

  if (plan.op === RelationOp.Compose) {
    // Execute with a witness (mid) so we can emit two-premise justifications.
    const left = executeRelation(plan.left, kbState);
    const right = executeRelation(plan.right, kbState);
    for (let subjectId = 0; subjectId < left.rows.length; subjectId += 1) {
      left.rows[subjectId].iterateSetBits((mid) => {
        const row = right.rows[mid];
        if (!row) return;
        row.iterateSetBits((objectId) => callback(subjectId, objectId, mid));
      });
    }
    return;
  }

  if (plan.op === RelationOp.RestrictSubjects || plan.op === RelationOp.RestrictObjects) {
    // Fallback: materialize then iterate.
    const rel = executeRelation(plan, kbState);
    for (let subjectId = 0; subjectId < rel.rows.length; subjectId += 1) {
      rel.rows[subjectId].iterateSetBits((objectId) => callback(subjectId, objectId, null));
    }
  }
}

function premiseIdForEdge(plan, kbState, store, subjectId, objectId) {
  if (!store || !plan) return null;
  if (plan.op === RelationOp.BaseRelation) {
    return store.makeFactId(plan.predId, subjectId, objectId);
  }
  if (plan.op === RelationOp.InverseRelation) {
    return store.makeFactId(plan.predId, objectId, subjectId);
  }
  // For composed / restricted plans, we only support premise IDs via the applyRelationRule fast-path.
  return null;
}

function applyRelationRule(rule, kbApi, options) {
  if (!rule || rule.kind !== "RelationRulePlan") return 0;
  const kbState = kbApi?.kb;
  if (!kbState) return 0;

  const store = options?.justificationStore;
  const ruleId = options?.ruleId;
  const headPredId = rule.headPredId;
  if (!Number.isInteger(headPredId)) return 0;

  let added = 0;
  const plan = rule.relation;

  if (plan?.kind === "RelationPlan" && plan.op === RelationOp.Compose) {
    const leftPlan = plan.left;
    const rightPlan = plan.right;
    iterRelationEdges(plan, kbState, (subjectId, objectId, mid) => {
      if (!Number.isInteger(subjectId) || !Number.isInteger(objectId)) return;
      if (kbApi.insertBinary(subjectId, headPredId, objectId)) {
        added += 1;
        if (store && Number.isInteger(ruleId) && Number.isInteger(mid)) {
          const premiseA = premiseIdForEdge(leftPlan, kbState, store, subjectId, mid);
          const premiseB = premiseIdForEdge(rightPlan, kbState, store, mid, objectId);
          const premiseIds = [premiseA, premiseB].filter((x) => x !== null);
          const factId = store.makeFactId(headPredId, subjectId, objectId);
          store.addDerivedFact(factId, ruleId, premiseIds);
        }
        if (options?.deltaPred instanceof Set) {
          options.deltaPred.add(headPredId);
        }
      }
    });
    return added;
  }

  iterRelationEdges(plan, kbState, (subjectId, objectId) => {
    if (!Number.isInteger(subjectId) || !Number.isInteger(objectId)) return;
    if (kbApi.insertBinary(subjectId, headPredId, objectId)) {
      added += 1;
      if (store && Number.isInteger(ruleId)) {
        const premise = premiseIdForEdge(plan, kbState, store, subjectId, objectId);
        const premiseIds = premise ? [premise] : [];
        const factId = store.makeFactId(headPredId, subjectId, objectId);
        store.addDerivedFact(factId, ruleId, premiseIds);
      }
      if (options?.deltaPred instanceof Set) {
        options.deltaPred.add(headPredId);
      }
    }
  });

  return added;
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

function collectDepsFromRelationPlan(plan, deps) {
  if (!plan || plan.kind !== "RelationPlan" || !deps) return deps;
  switch (plan.op) {
    case RelationOp.BaseRelation:
    case RelationOp.InverseRelation:
      deps.predIds.add(plan.predId);
      return deps;
    case RelationOp.RestrictSubjects:
      collectDepsFromRelationPlan(plan.relation, deps);
      collectDepsFromSetPlan(plan.subjectSet, deps);
      return deps;
    case RelationOp.RestrictObjects:
      collectDepsFromRelationPlan(plan.relation, deps);
      collectDepsFromSetPlan(plan.objectSet, deps);
      return deps;
    case RelationOp.Compose:
      collectDepsFromRelationPlan(plan.left, deps);
      collectDepsFromRelationPlan(plan.right, deps);
      return deps;
    default:
      return deps;
  }
}

function computeRuleDeps(rule) {
  const deps = { unaryIds: new Set(), predIds: new Set(), attrIds: new Set() };
  if (rule.kind === "RelationRulePlan") {
    collectDepsFromRelationPlan(rule.relation, deps);
    if (Number.isInteger(rule.headPredId)) deps.predIds.add(rule.headPredId);
    return deps;
  }

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
  const signatureToId = new Map();
  const duplicateCounts = new Map(); // signature -> { ruleId, count }

  function addRule(plan) {
    const signature = signatureForRule(plan);
    if (signature && signatureToId.has(signature)) {
      const ruleId = signatureToId.get(signature);
      const entry = duplicateCounts.get(signature) ?? { ruleId, count: 1 };
      entry.count += 1;
      duplicateCounts.set(signature, entry);
      return ruleId;
    }

    const id = rules.length;
    if (plan && (plan.kind === "RulePlan" || plan.kind === "RelationRulePlan")) {
      plan.deps = computeRuleDeps(plan);
    }
    rules.push(plan);
    if (signature) signatureToId.set(signature, id);
    return id;
  }

  function getRules() {
    return rules.slice();
  }

  function getDuplicateRules() {
    return [...duplicateCounts.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
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
    getDuplicateRules,
    applyRules,
  };
}
