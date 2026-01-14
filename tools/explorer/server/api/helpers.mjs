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
      if (value instanceof Map) return { __type: "Map", entries: [...value.entries()] };
      if (value instanceof Set) return { __type: "Set", values: [...value.values()] };
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
  if (key && key.includes(":")) {
    const idx = key.indexOf(":");
    return key.slice(idx + 1);
  }
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

function renderNodeText(node) {
  if (!node) return "";
  if (node.kind === "Name") return node.value;
  if (node.kind === "Variable") return `?${node.name}`;
  if (node.kind === "NumberLiteral") return String(node.value);
  if (node.kind === "NounPhrase") {
    const core = Array.isArray(node.core) ? node.core.join(" ") : "";
    const prefix = node.prefix?.kind === "Quantifier" ? node.prefix.q : node.prefix?.kind === "Determiner" ? node.prefix.d : "";
    const parts = [prefix, core].filter(Boolean);
    return parts.join(" ").trim();
  }
  return node.kind || "";
}

function renderVerbGroup(vg) {
  if (!vg) return "";
  const parts = [];
  if (vg.auxiliary) parts.push(vg.auxiliary);
  if (vg.verb) parts.push(vg.verb);
  (vg.particles ?? []).forEach((p) => parts.push(p));
  return parts.filter(Boolean).join(" ");
}

function renderComplement(comp) {
  if (!comp) return "";
  if (comp.kind === "Name") return comp.value;
  if (comp.kind === "NounPhrase") return renderNodeText(comp);
  return renderNodeText(comp);
}

function renderAssertion(assertion) {
  if (!assertion) return "";
  switch (assertion.kind) {
    case "CopulaPredicateAssertion":
      return `${renderNodeText(assertion.subject)} is a ${renderComplement(assertion.complement)}`.trim();
    case "ActiveRelationAssertion":
      return `${renderNodeText(assertion.subject)} ${renderVerbGroup(assertion.verbGroup)} ${renderNodeText(assertion.object)}`.trim();
    case "PassiveRelationAssertion":
      return `${renderNodeText(assertion.subject)} is ${assertion.verb} ${assertion.preposition} ${renderNodeText(assertion.object)}`.trim();
    case "AttributeAssertion":
      return `${renderNodeText(assertion.subject)} has a ${renderNodeText(assertion.attribute)} of ${renderNodeText(assertion.value)}`.trim();
    case "ComparisonAssertion":
      return `${renderNodeText(assertion.left)} is ${assertion.comparator?.op} ${renderNodeText(assertion.right)}`.trim();
    default:
      return `${assertion.kind}`.trim();
  }
}

function renderCondition(condition) {
  if (!condition) return "";
  switch (condition.kind) {
    case "AtomicCondition":
      return renderAssertion(condition.assertion);
    case "AndChain":
      return (condition.items ?? []).map(renderCondition).filter(Boolean).join(" and ");
    case "OrChain":
      return (condition.items ?? []).map(renderCondition).filter(Boolean).join(" or ");
    case "EitherOr":
      return [renderCondition(condition.left), renderCondition(condition.right)].filter(Boolean).join(" or ");
    case "BothAnd":
      return [renderCondition(condition.left), renderCondition(condition.right)].filter(Boolean).join(" and ");
    case "CaseScope":
      if (condition.mode === "negative") return `it is not the case that (${renderCondition(condition.operand)})`;
      return renderCondition(condition.operand);
    case "GroupCondition":
      return `(${renderCondition(condition.inner)})`;
    default:
      return condition.kind || "";
  }
}

export function describeTransitionRuleNL(rule) {
  if (!rule || (rule.kind !== "TransitionRule" && rule.kind !== "TransitionRuleStatement")) return null;
  const event = renderCondition(rule.event);
  const effectSentence =
    rule.effect?.kind === "AssertionSentence"
      ? renderAssertion(rule.effect.assertion)
      : rule.effect?.kind === "BecauseSentence"
        ? `${renderAssertion(rule.effect.assertion)} because ${renderCondition(rule.effect.because)}`
        : rule.effect?.kind
          ? rule.effect.kind
          : "";
  const whenText = event ? `When ${event} occurs` : "When an event occurs";
  const thenText = effectSentence || "nothing happens";
  return {
    natural: `${whenText}, then ${thenText}.`,
    event: event || "(unrenderable event)",
    effect: effectSentence || "(unrenderable effect)",
  };
}

// Describe a relation plan (for RelationRulePlan)
function describeRelationPlanNL(rel, idStore) {
  if (!rel) return "relation";
  if (rel.op === "BaseRelation") {
    return NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, rel.predId));
  }
  if (rel.op === "InverseRelation") {
    const pred = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, rel.predId));
    return `inverse of ${pred}`;
  }
  if (rel.op === "Compose") {
    const left = describeRelationPlanNL(rel.left, idStore);
    const right = describeRelationPlanNL(rel.right, idStore);
    return `${left} composed with ${right}`;
  }
  return "relation";
}

// Describe any rule (RulePlan or RelationRulePlan)
export function describeRuleNL(rule, idStore) {
  if (rule.kind === "RulePlan") {
    const cond = describeSetPlanNL(rule.body, idStore);
    const effect = describeHeadNL(rule.head, idStore);
    return `If ${cond} then ${effect}`;
  }
  if (rule.kind === "RelationRulePlan") {
    const rel = describeRelationPlanNL(rule.relation, idStore);
    const head = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, rule.headPredId));
    return `${rel} implies ${head}`;
  }
  return `Rule (${rule.kind})`;
}
