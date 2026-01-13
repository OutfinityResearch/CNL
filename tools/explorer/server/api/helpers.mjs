import { parseProgram } from "../../../../src/parser/grammar.mjs";
import { ConceptKind } from "../../../../src/ids/interners.mjs";
import * as NLG from "../nlg.mjs";

// Re-export for routes
export { ConceptKind, NLG, parseProgram };

export function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      return value;
    })
  );
}

export async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function createError(code, message, hint = "") {
  return {
    code,
    name: "ExplorerError",
    message,
    severity: "error",
    primaryToken: "EOF",
    hint,
  };
}

export function normalizeCommandError(error) {
  if (!error) return null;
  if (typeof error === "string") {
    return createError("CMD000", error);
  }
  if (typeof error === "object") {
    if (error.code && error.message) return error;
    if (error.message) return createError("CMD000", error.message);
  }
  return createError("CMD001", "Command failed.");
}

export function parseProgramSafe(text) {
  try {
    return { ast: parseProgram(text), error: null };
  } catch (error) {
    return { ast: null, error };
  }
}

export function getName(idStore, kind, denseId) {
  const cid = idStore.getConceptualId(kind, denseId);
  if (cid === undefined) return `[${denseId}]`;
  const key = idStore.lookupKey(cid);
  if (key && key.includes(":")) return key.split(":")[1];
  return key || `[${denseId}]`;
}

export function bitsetPopcount(bitset) {
  return bitset ? bitset.popcount() : 0;
}

export function safeHasBit(bitset, index) {
  if (!bitset || !Number.isInteger(index) || typeof bitset.size !== "number" || !Number.isFinite(bitset.size)) {
    return false;
  }
  if (index < 0 || index >= bitset.size) {
    return false;
  }
  return bitset.hasBit(index);
}

export function getStats(session) {
  const rawKb = session.state.kb.kb;
  return {
    entities: rawKb.entitiesCount,
    predicates: rawKb.predicatesCount,
    unaries: rawKb.unaryCount,
    attributes: rawKb.attributesCount,
  };
}

export function getSummary(session) {
  const rawKb = session.state.kb.kb;
  const ruleStore = session.state.ruleStore;
  const actionStore = session.state.actionStore;
  return {
    things: rawKb.entitiesCount,
    categories: rawKb.unaryCount,
    relationships: rawKb.predicatesCount,
    rules: ruleStore.getRules().length,
    actions: actionStore.getActions().length,
  };
}

export function formatEntityKey(key, fallback) {
  return NLG.formatEntityName(key) || fallback;
}

export function formatResultOutput(result, context = {}) {
  return NLG.formatResultMessage(result, context);
}

export function describeSetPlan(plan, idStore) {
  if (!plan) return "None";
  if (plan.op === "UnarySet") return getName(idStore, ConceptKind.UnaryPredicate, plan.unaryId);
  if (plan.op === "EntitySet") return `Reference(${getName(idStore, ConceptKind.Entity, plan.entityId)})`;
  if (plan.op === "Intersect") return `(${plan.plans.map((p) => describeSetPlan(p, idStore)).join(" AND ")})`;
  if (plan.op === "Union") return `(${plan.plans.map((p) => describeSetPlan(p, idStore)).join(" OR ")})`;
  if (plan.op === "Not") return `NOT (${describeSetPlan(plan.plan, idStore)})`;
  if (plan.op === "Image") {
    return `(${describeSetPlan(plan.subjectSet, idStore)}) -> ${getName(idStore, ConceptKind.Predicate, plan.predId)}`;
  }
  return plan.op || "UnknownSetPlan";
}

export function describeHead(head, idStore) {
  if (!head) return "No Effect";
  if (head.kind === "UnaryEmit") return `Subject is ${getName(idStore, ConceptKind.UnaryPredicate, head.unaryId)}`;
  if (head.kind === "BinaryEmit") {
    return `Subject -> ${getName(idStore, ConceptKind.Predicate, head.predId)} -> Object`;
  }
  return head.kind;
}

export function extractConditions(plan, idStore, list = []) {
  if (!plan) return list;
  if (plan.op === "Intersect") {
    plan.plans.forEach((p) => extractConditions(p, idStore, list));
  } else {
    list.push(describeSetPlan(plan, idStore));
  }
  return list;
}

export function describeSetPlanNL(plan, idStore) {
  if (!plan) return "anything";
  if (plan.op === "UnarySet") {
    const cat = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, plan.unaryId));
    return `something is a ${cat}`;
  }
  if (plan.op === "EntitySet") {
    return NLG.formatEntityName(getName(idStore, ConceptKind.Entity, plan.entityId));
  }
  if (plan.op === "Intersect") {
    return plan.plans.map((p) => describeSetPlanNL(p, idStore)).join(" and ");
  }
  if (plan.op === "Union") {
    return plan.plans.map((p) => describeSetPlanNL(p, idStore)).join(" or ");
  }
  if (plan.op === "Not") {
    return `not (${describeSetPlanNL(plan.plan, idStore)})`;
  }
  if (plan.op === "Image") {
    const pred = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, plan.predId));
    return `something ${pred} something`;
  }
  if (plan.op === "Preimage") {
    const pred = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, plan.predId));
    return `something is ${pred} by something`;
  }
  return "something";
}

export function describeHeadNL(head, idStore) {
  if (!head) return "nothing happens";
  if (head.kind === "UnaryEmit") {
    const cat = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, head.unaryId));
    return `it is a ${cat}`;
  }
  if (head.kind === "BinaryEmit") {
    const pred = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, head.predId));
    return `it ${pred} something`;
  }
  return "effect";
}
