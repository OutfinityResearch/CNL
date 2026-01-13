import { executeSet } from "../../plans/execute.mjs";
import { SetOp } from "../../plans/ir.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { formatFactId } from "./facts.mjs";
import { renderDerivation } from "./derivation.mjs";

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  return key;
}

function entityName(entityId, state) {
  const conceptId = state.idStore.getConceptualId(ConceptKind.Entity, entityId);
  const key = conceptId ? state.idStore.lookupKey(conceptId) : null;
  return displayEntityKey(key) || `Entity_${entityId}`;
}

function safeHasBit(bitset, index) {
  if (!bitset || !Number.isInteger(index)) return false;
  if (typeof bitset.size !== "number") return false;
  if (index < 0 || index >= bitset.size) return false;
  return bitset.hasBit(index);
}

function dedupeFactIds(factIds) {
  const seen = new Set();
  const out = [];
  for (const factId of factIds) {
    const key = typeof factId === "bigint" ? `B:${factId.toString()}` : `S:${String(factId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(factId);
  }
  return out;
}

function witnessFactIdsForMembership(plan, subjectId, kbState, store) {
  if (!plan || plan.kind !== "SetPlan") return [];
  switch (plan.op) {
    case SetOp.AllEntities:
      return [];
    case SetOp.EntitySet:
      return [];
    case SetOp.UnarySet:
      return store ? [store.makeUnaryFactId(plan.unaryId, subjectId)] : [];
    case SetOp.Intersect: {
      const out = [];
      for (const child of plan.plans ?? []) {
        out.push(...witnessFactIdsForMembership(child, subjectId, kbState, store));
      }
      return out;
    }
    case SetOp.Union: {
      for (const child of plan.plans ?? []) {
        const set = executeSet(child, kbState);
        if (safeHasBit(set, subjectId)) {
          return witnessFactIdsForMembership(child, subjectId, kbState, store);
        }
      }
      return [];
    }
    case SetOp.Preimage: {
      if (!store) return [];
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
      return [
        store.makeFactId(plan.predId, subjectId, found),
        ...witnessFactIdsForMembership(plan.objectSet, found, kbState, store),
      ];
    }
    case SetOp.Image: {
      if (!store) return [];
      const matrix = kbState.invRelations[plan.predId];
      if (!matrix) return [];
      const subjects = executeSet(plan.subjectSet, kbState);
      const row = matrix.rows[subjectId];
      if (!row) return [];
      const intersection = row.and(subjects);
      let found = null;
      intersection.iterateSetBits((subjectCandidate) => {
        if (found === null) found = subjectCandidate;
      });
      if (found === null) return [];
      return [
        store.makeFactId(plan.predId, found, subjectId),
        ...witnessFactIdsForMembership(plan.subjectSet, found, kbState, store),
      ];
    }
    case SetOp.NumFilter: {
      if (!store) return [];
      const index = kbState.numericIndex[plan.attrId];
      if (!index) return [];
      if (subjectId < 0 || subjectId >= index.values.length) return [];
      if (subjectId < 0 || subjectId >= index.hasValue.size) return [];
      if (!index.hasValue.hasBit(subjectId)) return [];
      return [store.makeNumericFactId(plan.attrId, subjectId, index.values[subjectId])];
    }
    case SetOp.AttrEntityFilter: {
      if (!store) return [];
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
      return [
        store.makeEntityAttrFactId(plan.attrId, subjectId, found),
        ...witnessFactIdsForMembership(plan.valueSet, found, kbState, store),
      ];
    }
    case SetOp.Not:
    default:
      return [];
  }
}

export function buildWitnessTraceForSet(setPlan, entities, state, options = {}) {
  const store = state.justificationStore;
  const kbState = state.kb.kb;
  const limit = options.limit ?? 3;
  const shown = (entities ?? []).slice(0, limit);

  const steps = [];
  const premiseSet = new Set();

  steps.push(`Returned ${entities?.length ?? 0} result(s).`);

  for (const entity of shown) {
    const id = Number.isInteger(entity?.id) ? entity.id : null;
    if (id === null) continue;
    steps.push(`Witness for ${entityName(id, state)}:`);
    const factIds = dedupeFactIds(witnessFactIdsForMembership(setPlan, id, kbState, store));
    if (factIds.length === 0) {
      steps.push("  (no witness facts available)");
      continue;
    }
    for (const factId of factIds) {
      if (store && store.getJustification(factId)) {
        const trace = renderDerivation(factId, state, store, { maxSteps: 30 });
        trace.premises.forEach((p) => premiseSet.add(p));
        trace.steps.forEach((line) => steps.push(`  ${line}`));
        continue;
      }
      const sentence = store ? formatFactId(factId, state, store) : null;
      steps.push(`  ${sentence ?? String(factId)}`);
    }
  }

  return {
    kind: "ProofTrace",
    mode: "Witness",
    conclusion: "result set membership",
    answerSummary: `count=${entities?.length ?? 0}`,
    steps,
    premises: Array.from(premiseSet).sort(),
  };
}

