import {
  ConceptKind,
  NLG,
  describeHead,
  describeHeadNL,
  describeSetPlan,
  describeSetPlanNL,
  getName,
  json,
  safeHasBit,
} from "../helpers.mjs";

export function handleEntity(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/entity") return false;
  const { rawKb, idStore, ruleStore, actionStore } = context;
  const type = url.searchParams.get("type");
  const denseIdParam = url.searchParams.get("id");
  const nameParam = url.searchParams.get("name");

  let denseId = null;
  if (nameParam) {
    const entCount = idStore.size(ConceptKind.Entity);
    for (let i = 0; i < entCount; i++) {
      if (getName(idStore, ConceptKind.Entity, i) === nameParam) {
        denseId = i;
        break;
      }
    }
    if (denseId === null) {
      json(res, 404, { ok: false, error: `Entity '${nameParam}' not found.` });
      return true;
    }
  } else if (denseIdParam && !Number.isNaN(parseInt(denseIdParam, 10))) {
    denseId = parseInt(denseIdParam, 10);
  } else {
    json(res, 400, { ok: false, error: "Provide id or name parameter." });
    return true;
  }

  if (type === "entity") {
    const name = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, denseId));

    const categories = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], denseId)) {
        categories.push({
          name: NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u)),
          source: "stated",
        });
      }
    }

    const outgoing = [];
    for (let p = 0; p < rawKb.predicatesCount; p++) {
      if (rawKb.relations[p] && rawKb.relations[p].rows[denseId]) {
        const targets = rawKb.relations[p].rows[denseId];
        const verb = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, p));
        const limit = Math.min(rawKb.entitiesCount, targets.size);
        for (let t = 0; t < limit; t++) {
          if (safeHasBit(targets, t)) {
            outgoing.push({
              verb,
              object: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, t)),
              objectId: t,
            });
          }
        }
      }
    }

    const incoming = [];
    for (let p = 0; p < rawKb.predicatesCount; p++) {
      if (rawKb.invRelations[p] && rawKb.invRelations[p].rows[denseId]) {
        const sources = rawKb.invRelations[p].rows[denseId];
        const verb = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, p));
        const limit = Math.min(rawKb.entitiesCount, sources.size);
        for (let s = 0; s < limit; s++) {
          if (safeHasBit(sources, s)) {
            incoming.push({
              verb,
              subject: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s)),
              subjectId: s,
            });
          }
        }
      }
    }

    const attributes = [];

    const raw = categories.length > 0 || outgoing.length > 0 || incoming.length > 0 ? { denseId, conceptKey: `E:${name}` } : null;

    json(res, 200, {
      ok: true,
      entity: { name, id: denseId, categories, outgoing, incoming, attributes, raw },
    });
    return true;
  }

  if (type === "unary") {
    const name = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, denseId));
    const bitset = denseId < rawKb.unaryIndex.length ? rawKb.unaryIndex[denseId] : null;

    const members = [];
    if (bitset) {
      const limit = Math.min(rawKb.entitiesCount, bitset.size);
      for (let e = 0; e < limit; e++) {
        if (safeHasBit(bitset, e)) {
          members.push({
            name: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, e)),
            id: e,
          });
        }
      }
    }

    const raw = members.length > 0 ? { denseId, conceptKey: `U:${name}` } : null;

    json(res, 200, {
      ok: true,
      category: { name, id: denseId, memberCount: members.length, members, raw },
    });
    return true;
  }

  if (type === "predicate") {
    const name = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, denseId));
    const matrix = denseId < rawKb.relations.length ? rawKb.relations[denseId] : null;

    const connections = [];
    const subjects = new Set();
    const objects = new Set();

    if (matrix) {
      const subjectLimit = Math.min(rawKb.entitiesCount, matrix.rows.length);
      for (let s = 0; s < subjectLimit; s++) {
        const row = matrix.rows[s];
        if (row) {
          const objectLimit = Math.min(rawKb.entitiesCount, row.size);
          for (let o = 0; o < objectLimit; o++) {
            if (safeHasBit(row, o)) {
              const subj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s));
              const obj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, o));
              connections.push({
                subject: subj,
                subjectId: s,
                object: obj,
                objectId: o,
                sentence: `${subj} ${name} ${obj}`,
              });
              subjects.add(subj);
              objects.add(obj);
            }
          }
        }
      }
    }

    const raw = connections.length > 0 ? { denseId, conceptKey: `P:${name}` } : null;

    json(res, 200, {
      ok: true,
      relationship: {
        name,
        id: denseId,
        connectionCount: connections.length,
        connections,
        subjects: [...subjects],
        objects: [...objects],
        raw,
      },
    });
    return true;
  }

  if (type === "rule") {
    const rules = ruleStore.getRules();
    if (!rules[denseId]) {
      json(res, 404, { ok: false, error: "Rule not found." });
      return true;
    }

    const rule = rules[denseId];
    const conditionNL = describeSetPlanNL(rule.body, idStore);
    const effectNL = describeHeadNL(rule.head, idStore);
    const natural = `If ${conditionNL}, then ${effectNL}.`;

    const appliedTo = [];

    json(res, 200, {
      ok: true,
      rule: {
        id: denseId,
        natural,
        condition: {
          text: conditionNL,
          technical: describeSetPlan(rule.body, idStore),
        },
        effect: {
          text: effectNL,
          technical: describeHead(rule.head, idStore),
        },
        appliedTo,
        raw: rule,
      },
    });
    return true;
  }

  if (type === "action") {
    const actions = actionStore.getActions();
    if (!actions[denseId]) {
      json(res, 404, { ok: false, error: "Action not found." });
      return true;
    }

    const action = actions[denseId];
    const name = action.name ? action.name.value : `Action #${denseId}`;

    json(res, 200, {
      ok: true,
      action: {
        id: denseId,
        name,
        agent: action.agent ? action.agent : null,
        precondition: action.precondition ? "defined" : null,
        effect: action.effect ? "defined" : null,
        raw: action,
      },
    });
    return true;
  }

  json(res, 400, { ok: false, error: `Unknown type: ${type}` });
  return true;
}
