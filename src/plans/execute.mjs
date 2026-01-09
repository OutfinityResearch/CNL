import { createBitset, createFullBitset } from "../kb/bitset.mjs";
import { SetOp, RelationOp, BoolOp, NumberOp } from "./ir.mjs";

function resolveKb(kb) {
  return kb && kb.kb ? kb.kb : kb;
}

function emptySet(kbState) {
  return createBitset(kbState.entitiesCount);
}

function normalizeComparator(comparator) {
  const raw = String(comparator).toLowerCase().trim();
  switch (raw) {
    case "gt":
    case ">":
    case "greater than":
      return "gt";
    case "gte":
    case ">=":
    case "greater than or equal to":
    case "at least":
      return "gte";
    case "lt":
    case "<":
    case "less than":
      return "lt";
    case "lte":
    case "<=":
    case "less than or equal to":
    case "at most":
      return "lte";
    case "eq":
    case "=":
    case "equal to":
      return "eq";
    case "neq":
    case "!=":
    case "not equal to":
      return "neq";
    default:
      return null;
  }
}

function compareValues(comparator, left, right) {
  const normalized = normalizeComparator(comparator);
  if (!normalized) return false;
  switch (normalized) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    default:
      return false;
  }
}

export function executeSet(plan, kb) {
  const kbState = resolveKb(kb);
  if (!plan) return emptySet(kbState);

  switch (plan.op) {
    case SetOp.AllEntities:
      return createFullBitset(kbState.entitiesCount);
    case SetOp.UnarySet: {
      const set = kbState.unaryIndex[plan.unaryId];
      return set ? set.clone() : emptySet(kbState);
    }
    case SetOp.EntitySet: {
      const set = createBitset(kbState.entitiesCount);
      if (plan.entityId < kbState.entitiesCount) {
        set.setBit(plan.entityId);
      }
      return set;
    }
    case SetOp.Intersect: {
      const plans = plan.plans ?? [];
      if (plans.length === 0) return emptySet(kbState);
      let acc = executeSet(plans[0], kbState);
      for (let i = 1; i < plans.length; i += 1) {
        acc = acc.and(executeSet(plans[i], kbState));
      }
      return acc;
    }
    case SetOp.Union: {
      const plans = plan.plans ?? [];
      if (plans.length === 0) return emptySet(kbState);
      let acc = executeSet(plans[0], kbState);
      for (let i = 1; i < plans.length; i += 1) {
        acc = acc.or(executeSet(plans[i], kbState));
      }
      return acc;
    }
    case SetOp.Not: {
      const universe = executeSet(plan.universe, kbState);
      const operand = executeSet(plan.plan, kbState);
      return universe.andNot(operand);
    }
    case SetOp.Image: {
      const subjects = executeSet(plan.subjectSet, kbState);
      let result = emptySet(kbState);
      const relation = kbState.relations[plan.predId];
      if (!relation) return result;
      subjects.iterateSetBits((subjectId) => {
        result = result.or(relation.rows[subjectId]);
      });
      return result;
    }
    case SetOp.Preimage: {
      const objects = executeSet(plan.objectSet, kbState);
      let result = emptySet(kbState);
      const relation = kbState.invRelations[plan.predId];
      if (!relation) return result;
      objects.iterateSetBits((objectId) => {
        result = result.or(relation.rows[objectId]);
      });
      return result;
    }
    case SetOp.NumFilter: {
      const index = kbState.numericIndex[plan.attrId];
      if (!index) return emptySet(kbState);
      return index.filter(plan.comparator, plan.value);
    }
    case SetOp.AttrEntityFilter: {
      const index = kbState.entAttrIndex[plan.attrId];
      if (!index) return emptySet(kbState);
      const valueSet = executeSet(plan.valueSet, kbState);
      return index.filter(valueSet);
    }
    default:
      return emptySet(kbState);
  }
}

export function executeRelation(plan, kb) {
  const kbState = resolveKb(kb);
  if (!plan) return { rows: [] };

  switch (plan.op) {
    case RelationOp.BaseRelation:
      return kbState.relations[plan.predId] ?? { rows: [] };
    case RelationOp.RestrictSubjects: {
      const relation = executeRelation(plan.relation, kbState);
      const subjectSet = executeSet(plan.subjectSet, kbState);
      const rows = relation.rows.map((row, subjectId) => {
        if (!subjectSet.hasBit(subjectId)) return createBitset(kbState.entitiesCount);
        return row.clone();
      });
      return { rows };
    }
    case RelationOp.RestrictObjects: {
      const relation = executeRelation(plan.relation, kbState);
      const objectSet = executeSet(plan.objectSet, kbState);
      const rows = relation.rows.map((row) => row.and(objectSet));
      return { rows };
    }
    case RelationOp.Compose: {
      const left = executeRelation(plan.left, kbState);
      const right = executeRelation(plan.right, kbState);
      const rows = [];
      for (let subjectId = 0; subjectId < left.rows.length; subjectId += 1) {
        let acc = createBitset(kbState.entitiesCount);
        left.rows[subjectId].iterateSetBits((mid) => {
          acc = acc.or(right.rows[mid]);
        });
        rows.push(acc);
      }
      return { rows };
    }
    default:
      return { rows: [] };
  }
}

export function executeBool(plan, kb) {
  const kbState = resolveKb(kb);
  if (!plan) return false;

  switch (plan.op) {
    case BoolOp.Exists:
      return !executeSet(plan.set, kbState).isEmpty();
    case BoolOp.IsEmpty:
      return executeSet(plan.set, kbState).isEmpty();
    case BoolOp.Compare: {
      const left = executeNumber(plan.left, kbState);
      const right = executeNumber(plan.right, kbState);
      return compareValues(plan.comparator, left, right);
    }
    default:
      return false;
  }
}

export function executeNumber(plan, kb) {
  const kbState = resolveKb(kb);
  if (!plan) return Number.NaN;

  switch (plan.op) {
    case NumberOp.AttrValue: {
      const index = kbState.numericIndex[plan.attrId];
      if (!index) return Number.NaN;
      if (!index.hasValue.hasBit(plan.subjectId)) return Number.NaN;
      return index.values[plan.subjectId];
    }
    case NumberOp.Aggregate: {
      if (plan.aggregateOp === "NumberOf") {
        return executeSet(plan.set, kbState).popcount();
      }
      return Number.NaN;
    }
    default:
      return Number.NaN;
  }
}
