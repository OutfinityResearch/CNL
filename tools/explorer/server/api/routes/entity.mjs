import {
  ConceptKind,
  NLG,
  describeHead,
  describeHeadNL,
  describeSetPlan,
  describeSetPlanNL,
  describeTransitionRuleNL,
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

  function lookupRawKey(kind, denseId) {
    const cid = idStore.getConceptualId(kind, denseId);
    return cid === undefined ? null : idStore.lookupKey(cid);
  }

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
    const rawKey = lookupRawKey(ConceptKind.Entity, denseId) || null;
    const conceptualId = idStore.getConceptualId(ConceptKind.Entity, denseId);
    const name = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, denseId));
    const isSymbol = typeof rawKey === "string" && (rawKey.startsWith("L:") || rawKey.startsWith("E:lit:"));

    const categories = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], denseId)) {
        categories.push({
          name: NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u)),
          unaryId: u,
          rawKey: lookupRawKey(ConceptKind.UnaryPredicate, u) || null,
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
              predId: p,
              rawKey: lookupRawKey(ConceptKind.Predicate, p) || null,
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
              predId: p,
              rawKey: lookupRawKey(ConceptKind.Predicate, p) || null,
              subject: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s)),
              subjectId: s,
            });
          }
        }
      }
    }

    const attributes = [];

    const raw = {
      kind: "entity",
      denseId,
      conceptualId,
      rawKey,
      name,
      isSymbol,
      categoryIds: categories.map((c) => c.unaryId),
      outgoing: outgoing.map((o) => ({ predId: o.predId, objectId: o.objectId })),
      incoming: incoming.map((i) => ({ predId: i.predId, subjectId: i.subjectId })),
      kbStats: { entitiesCount: rawKb.entitiesCount, predicatesCount: rawKb.predicatesCount, unaryCount: rawKb.unaryCount },
    };

    json(res, 200, {
      ok: true,
      entity: { name, id: denseId, categories, outgoing, incoming, attributes, raw },
    });
    return true;
  }

  if (type === "unary") {
    const rawKey = lookupRawKey(ConceptKind.UnaryPredicate, denseId) || null;
    const conceptualId = idStore.getConceptualId(ConceptKind.UnaryPredicate, denseId);
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

    const raw = {
      kind: "unary",
      denseId,
      conceptualId,
      rawKey,
      name,
      bitset: bitset ? { size: bitset.size, bits: bitset.bits } : null,
    };

    json(res, 200, {
      ok: true,
      category: { name, id: denseId, memberCount: members.length, members, raw },
    });
    return true;
  }

  if (type === "predicate") {
    const rawKey = lookupRawKey(ConceptKind.Predicate, denseId) || null;
    const conceptualId = idStore.getConceptualId(ConceptKind.Predicate, denseId);
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
          const subj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s));
          row.iterateSetBits((o) => {
            if (o < 0 || o >= rawKb.entitiesCount) return;
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
          });
        }
      }
    }

    const raw = {
      kind: "predicate",
      denseId,
      conceptualId,
      rawKey,
      name,
      matrix: matrix ? { rows: matrix.rows.length, entityCount: rawKb.entitiesCount } : null,
    };

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
    const appliedTo = [];
    if (rule?.kind === "TransitionRule" || rule?.kind === "TransitionRuleStatement") {
      const rendered = describeTransitionRuleNL(rule);
      json(res, 200, {
        ok: true,
        rule: {
          id: denseId,
          natural: rendered?.natural ?? "Transition rule.",
          condition: {
            text: rendered?.event ?? "(unrenderable event)",
            technical: "TransitionRule.event",
          },
          effect: {
            text: rendered?.effect ?? "(unrenderable effect)",
            technical: "TransitionRule.effect",
          },
          appliedTo,
          raw: rule,
        },
      });
      return true;
    }

    const conditionNL = describeSetPlanNL(rule.body, idStore);
    const effectNL = describeHeadNL(rule.head, idStore);
    const natural = `If ${conditionNL}, then ${effectNL}.`;

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
    const name = action.action ? String(action.action).trim() : action.name ? action.name.value : `Action #${denseId}`;
    const agent = action.agent ? String(action.agent).trim() : null;
    const preconditions = Array.isArray(action.preconditions)
      ? action.preconditions.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const effects = Array.isArray(action.effects)
      ? action.effects.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const intents = Array.isArray(action.intents)
      ? action.intents.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const intent = action.intent ? String(action.intent).trim() : intents[0] ?? null;

    const description = [];
    description.push(`Action: ${name}`);
    if (agent) description.push(`Agent constraint: ${agent}`);
    if (intent) description.push(`Intent: ${intent}`);
    if (preconditions.length > 0) {
      description.push(`Preconditions (${preconditions.length}):`);
      preconditions.slice(0, 20).forEach((p) => description.push(`- ${p}`));
      if (preconditions.length > 20) description.push(`- (and ${preconditions.length - 20} more)`);
    } else {
      description.push("Preconditions: (none)");
    }
    if (effects.length > 0) {
      description.push(`Effects (${effects.length}):`);
      effects.slice(0, 20).forEach((e) => description.push(`- ${e}`));
      if (effects.length > 20) description.push(`- (and ${effects.length - 20} more)`);
    } else {
      description.push("Effects: (none)");
    }

    json(res, 200, {
      ok: true,
      action: {
        id: denseId,
        name,
        agent,
        intent,
        intents,
        preconditions,
        effects,
        description: description.join("\n"),
        raw: action,
      },
    });
    return true;
  }

  json(res, 400, { ok: false, error: `Unknown type: ${type}` });
  return true;
}
