import {
  ConceptKind,
  NLG,
  describeRuleNL,
  describeTransitionRuleNL,
  getName,
  json,
  safeHasBit,
} from "../helpers.mjs";

function sortByCountDescThenName(a, b) {
  if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0);
  return String(a.name ?? "").localeCompare(String(b.name ?? ""));
}

function normalizeDuplicateKey(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function lookupRawKey(idStore, kind, denseId) {
  const cid = idStore.getConceptualId(kind, denseId);
  return cid === undefined ? null : idStore.lookupKey(cid);
}

function collectThings(rawKb, idStore) {
  const entCount = idStore.size(ConceptKind.Entity);
  const outDegree = new Array(entCount).fill(0);
  const inDegree = new Array(entCount).fill(0);

  if (Array.isArray(rawKb.relations)) {
    rawKb.relations.forEach((matrix) => {
      if (!matrix || !Array.isArray(matrix.rows)) return;
      const limit = Math.min(entCount, matrix.rows.length);
      for (let s = 0; s < limit; s++) {
        const row = matrix.rows[s];
        if (!row) continue;
        outDegree[s] += row.popcount();
      }
    });
  }

  if (Array.isArray(rawKb.invRelations)) {
    rawKb.invRelations.forEach((matrix) => {
      if (!matrix || !Array.isArray(matrix.rows)) return;
      const limit = Math.min(entCount, matrix.rows.length);
      for (let o = 0; o < limit; o++) {
        const row = matrix.rows[o];
        if (!row) continue;
        inDegree[o] += row.popcount();
      }
    });
  }

  const items = [];
  for (let i = 0; i < entCount; i++) {
    const rawKey = lookupRawKey(idStore, ConceptKind.Entity, i) || "";
    if (rawKey.startsWith("L:") || rawKey.startsWith("E:lit:")) continue;
    const name = NLG.formatEntityName(rawKey);
    const categories = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], i)) {
        categories.push(NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u)));
      }
    }
    const degree = (outDegree[i] || 0) + (inDegree[i] || 0);
    items.push({ id: i, name, categories: categories.sort(), degree, outDegree: outDegree[i] || 0, inDegree: inDegree[i] || 0 });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function collectConcepts(rawKb, idStore) {
  const unaryTotal = idStore.size(ConceptKind.UnaryPredicate);
  const items = [];
  for (let i = 0; i < unaryTotal; i++) {
    const name = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, i));
    const bitset = i < rawKb.unaryIndex.length ? rawKb.unaryIndex[i] : null;
    const count = bitset ? bitset.popcount() : 0;
    items.push({ id: i, name, count });
  }
  items.sort(sortByCountDescThenName);
  return items;
}

function collectRelations(rawKb, idStore) {
  const predTotal = idStore.size(ConceptKind.Predicate);
  const entCount = idStore.size(ConceptKind.Entity);
  const items = [];
  for (let i = 0; i < predTotal; i++) {
    let linkCount = 0;
    if (i < rawKb.relations.length) {
      const matrix = rawKb.relations[i];
      if (matrix) {
        for (let s = 0; s < matrix.rows.length; s++) {
          const row = matrix.rows[s];
          if (!row) continue;
          const limit = Math.min(entCount, row.size);
          for (let o = 0; o < limit; o++) {
            if (safeHasBit(row, o)) linkCount += 1;
          }
        }
      }
    }
    const name = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, i));
    items.push({ id: i, name, count: linkCount });
  }
  items.sort(sortByCountDescThenName);
  return items;
}

function collectRules(ruleStore, idStore) {
  const rules = ruleStore.getRules();
  const items = [];
  const dup = new Map();
  let transitions = 0;

  rules.forEach((rule, idx) => {
    if (!rule) return;
    if (rule.kind === "TransitionRule" || rule.kind === "TransitionRuleStatement") {
      transitions += 1;
      return;
    }
    let natural = `Rule #${idx}`;
    try {
      natural = describeRuleNL(rule, idStore);
    } catch {}
    const key = normalizeDuplicateKey(natural);
    const entry = dup.get(key) ?? { natural, count: 0, ids: [] };
    entry.count += 1;
    entry.ids.push(idx);
    dup.set(key, entry);
    items.push({ id: idx, natural, kind: rule.kind });
  });

  const duplicates = [...dup.values()].filter((d) => d.count > 1).sort((a, b) => b.count - a.count);

  const structuralDups = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
  const structuralDuplicates = structuralDups
    .map((entry) => {
      const rule = rules[entry.ruleId];
      if (!rule) return null;
      let natural = `Rule #${entry.ruleId}`;
      try {
        natural = describeRuleNL(rule, idStore);
      } catch {}
      return { natural, count: entry.count, ids: [entry.ruleId], kind: "structural" };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  const merged = [];
  const seen = new Set();
  for (const d of [...structuralDuplicates, ...duplicates]) {
    const key = normalizeDuplicateKey(d.natural);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(d);
  }

  return { items, duplicates: merged, transitions };
}

function collectTransitions(ruleStore) {
  const rules = ruleStore.getRules();
  const items = [];
  rules.forEach((rule, idx) => {
    if (rule?.kind !== "TransitionRule" && rule?.kind !== "TransitionRuleStatement") return;
    const rendered = describeTransitionRuleNL(rule);
    items.push({ id: idx, natural: rendered?.natural ?? `Transition #${idx}` });
  });
  return items;
}

function collectSymbols(rawKb, idStore) {
  const entCount = idStore.size(ConceptKind.Entity);
  const items = [];
  for (let i = 0; i < entCount; i++) {
    const rawKey = lookupRawKey(idStore, ConceptKind.Entity, i) || "";
    const isSymbol = rawKey.startsWith("L:") || rawKey.startsWith("E:lit:");
    if (!isSymbol) continue;
    items.push({ id: i, name: NLG.formatEntityName(rawKey), key: rawKey });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function collectActions(actionStore) {
  const actions = actionStore.getActions();
  return actions.map((action, idx) => {
    const name = action?.action ? String(action.action).trim() : action?.name?.value || `Action #${idx}`;
    const agent = action?.agent ? String(action.agent).trim() : "";
    const preconditions = Array.isArray(action?.preconditions) ? action.preconditions.map((s) => String(s).trim()).filter(Boolean) : [];
    const effects = Array.isArray(action?.effects) ? action.effects.map((s) => String(s).trim()).filter(Boolean) : [];
    const intents = Array.isArray(action?.intents) ? action.intents.map((s) => String(s).trim()).filter(Boolean) : [];
    const intent = action?.intent ? String(action.intent).trim() : (intents[0] ?? "");
    const summaryParts = [];
    if (agent) summaryParts.push(`agent: ${agent}`);
    if (preconditions.length) summaryParts.push(`${preconditions.length} preconditions`);
    if (effects.length) summaryParts.push(`${effects.length} effects`);
    if (intent) summaryParts.push(`intent: ${intent}`);
    const summary = summaryParts.join(" · ");
    return { id: idx, name, agent, preconditions, effects, intent, intents, summary };
  });
}

export function handleOverview(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/overview") return false;
  const kind = String(url.searchParams.get("kind") || "").toLowerCase();
  const nodeId = String(url.searchParams.get("id") || "");
  
  if (kind === "scoped") {
    const report = buildScopedOverview(nodeId, context);
    if (!report) {
      json(res, 404, { ok: false, error: "Scoped overview not found." });
      return true;
    }
    json(res, 200, { ok: true, overview: report });
    return true;
  }

  const overview = buildOverview(kind, context);
  if (!overview) {
    json(res, 400, { ok: false, error: "Unknown overview kind." });
    return true;
  }
  json(res, 200, { ok: true, overview });
  return true;
}

export function buildScopedOverview(nodeId, context) {
  const { rawKb, idStore, ruleStore, session } = context;

  function computeRuleGroupId(rule) {
    const unaryIds = rule?.deps?.unaryIds;
    const predIds = rule?.deps?.predIds;
    if (unaryIds && unaryIds.size > 0) {
      const minUnary = Math.min(...[...unaryIds]);
      return `rule-group-u-${minUnary}`;
    }
    if (predIds && predIds.size > 0) {
      const minPred = Math.min(...[...predIds]);
      return `rule-group-p-${minPred}`;
    }
    return "rule-group-general";
  }

  // 1. Rule Group: rule-group-{general|u-<id>|p-<id>}
  if (nodeId.startsWith("rule-group-")) {
    const rules = ruleStore.getRules();
    const filtered = [];
    let label = "general";
    const matchUnary = nodeId.match(/^rule-group-u-(\d+)$/);
    const matchPred = nodeId.match(/^rule-group-p-(\d+)$/);
    if (matchUnary) {
      const unaryId = parseInt(matchUnary[1], 10);
      label = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, unaryId));
    } else if (matchPred) {
      const predId = parseInt(matchPred[1], 10);
      label = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, predId));
    }

    rules.forEach((rule, idx) => {
      if (rule?.kind === "TransitionRule" || rule?.kind === "TransitionRuleStatement") return;
      const ruleGroupId = computeRuleGroupId(rule);
      if (ruleGroupId !== nodeId) return;
      let natural = `Rule #${idx}`;
      try {
        natural = describeRuleNL(rule, idStore);
      } catch {}
      filtered.push({ id: idx, natural });
    });

    return {
      kind: "scoped-rules",
      title: `Rules grouped under: ${label}`,
      summary: { count: filtered.length },
      items: filtered,
      raw: { nodeId, label, ruleIds: filtered.map((r) => r.id) },
    };
  }

  // 2. Warning Group: w-group-{concept}
  if (nodeId.startsWith("w-group-")) {
    const encoded = nodeId.replace("w-group-", "");
    const concept = decodeURIComponent(encoded);
    const issues = [];
    
    // Dictionary warnings
    const dictWarnings = session?.state?.dictionary?.warnings || [];
    dictWarnings.forEach((w, idx) => {
      const c = w.key || "general";
      if (c === concept) {
        issues.push({
          leafId: `w-issue-dict-${idx}`,
          message: w.message,
          reason: w.kind,
          severity: w.severity,
          raw: w,
        });
      }
    });

    // Rule duplicates
    const ruleDups = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
    if (concept === "duplicate-rules") {
      ruleDups.forEach(d => {
        issues.push({
          leafId: `w-issue-dupRule-${d.ruleId}`,
          message: `Rule #${d.ruleId} has ${d.count} duplicates`,
          reason: "Redundant rule definition",
          severity: "warning",
          raw: d,
        });
      });
    }

    return {
      kind: "scoped-warnings",
      title: `Issues with '${concept}'`,
      summary: { count: issues.length },
      items: issues.map(({ message, reason, severity }) => ({ message, reason, severity })),
      raw: { nodeId, concept, issues },
    };
  }

  function collectAllIssues() {
    const all = [];
    const dictErrors = session?.state?.dictionary?.errors || [];
    dictErrors.forEach((e, idx) => {
      all.push({
        source: "dictionary",
        leafId: `w-issue-dict-err-${idx}`,
        severity: "error",
        kind: e.kind || e.code || "DictionaryError",
        key: e.key || "general",
        message: e.message || "(no message)",
        raw: e,
      });
    });
    const dictWarnings = session?.state?.dictionary?.warnings || [];
    dictWarnings.forEach((w, idx) => {
      all.push({
        source: "dictionary",
        leafId: `w-issue-dict-${idx}`,
        severity: w.severity || "warning",
        kind: w.kind || "DictionaryWarning",
        key: w.key || "general",
        message: w.message || "(no message)",
        raw: w,
      });
    });
    const ruleDups = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
    ruleDups.forEach((d) => {
      all.push({
        source: "rules",
        leafId: `w-issue-dupRule-${d.ruleId}`,
        severity: "warning",
        kind: "DuplicateRule",
        key: "duplicate-rules",
        message: `Rule #${d.ruleId} has ${d.count} duplicates`,
        raw: d,
      });
    });
    return all;
  }

  // 2c. Warning severity group: w-sev-{error|warning}
  const sevMatch = nodeId.match(/^w-sev-(error|warning)$/);
  if (sevMatch) {
    const severity = sevMatch[1];
    const issues = collectAllIssues().filter((i) => i.severity === severity);
    return {
      kind: "scoped-warnings",
      title: `${severity === "error" ? "Errors" : "Warnings"} (${issues.length})`,
      summary: { count: issues.length, severity },
      items: issues.map((i) => ({ message: i.message, reason: i.kind, severity: i.severity })),
      raw: { nodeId, severity, issues },
    };
  }

  // 2d. Warning kind group: w-kind-{severity}-{kind}
  const kindMatch = nodeId.match(/^w-kind-(error|warning)-(.+)$/);
  if (kindMatch) {
    const severity = kindMatch[1];
    const kind = decodeURIComponent(kindMatch[2]);
    const issues = collectAllIssues().filter((i) => i.severity === severity && i.kind === kind);
    return {
      kind: "scoped-warnings",
      title: `${kind} (${issues.length})`,
      summary: { count: issues.length, severity, kind },
      items: issues.map((i) => ({ message: i.message, reason: i.key, severity: i.severity })),
      raw: { nodeId, severity, kind, issues },
    };
  }

  // 2e. Warning kind+concept group: w-kc-{severity}-{kind}-c-{concept}
  const kcMatch = nodeId.match(/^w-kc-(error|warning)-(.+)-c-(.+)$/);
  if (kcMatch) {
    const severity = kcMatch[1];
    const kind = decodeURIComponent(kcMatch[2]);
    const concept = decodeURIComponent(kcMatch[3]);
    const issues = collectAllIssues().filter((i) => i.severity === severity && i.kind === kind && i.key === concept);
    return {
      kind: "scoped-warnings",
      title: `${kind} · ${concept} (${issues.length})`,
      summary: { count: issues.length, severity, kind, concept },
      items: issues.map((i) => ({ message: i.message, reason: i.kind, severity: i.severity })),
      raw: { nodeId, severity, kind, concept, issues },
    };
  }

  // 2b. Warning leaf issue nodes
  const dictErrIssueMatch = nodeId.match(/^w-issue-dict-err-(\d+)$/);
  if (dictErrIssueMatch) {
    const idx = parseInt(dictErrIssueMatch[1], 10);
    const dictErrors = session?.state?.dictionary?.errors || [];
    const issue = dictErrors[idx];
    if (!issue) return null;
    const concept = issue.key || "general";
    return {
      kind: "warning-issue",
      title: "Error",
      summary: { concept, severity: "error", kind: issue.kind || issue.code },
      items: [{ message: issue.message }],
      raw: { nodeId, issueIndex: idx, issue },
    };
  }

  const dictIssueMatch = nodeId.match(/^w-issue-dict-(\d+)$/);
  if (dictIssueMatch) {
    const idx = parseInt(dictIssueMatch[1], 10);
    const dictWarnings = session?.state?.dictionary?.warnings || [];
    const issue = dictWarnings[idx];
    if (!issue) return null;
    const concept = issue.key || "general";
    return {
      kind: "warning-issue",
      title: "Warning",
      summary: { concept, severity: issue.severity, kind: issue.kind },
      items: [{ message: issue.message }],
      raw: { nodeId, issueIndex: idx, issue },
    };
  }

  const dupIssueMatch = nodeId.match(/^w-issue-dupRule-(\d+)$/);
  if (dupIssueMatch) {
    const ruleId = parseInt(dupIssueMatch[1], 10);
    const ruleDups = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
    const entry = ruleDups.find((d) => d.ruleId === ruleId);
    if (!entry) return null;
    return {
      kind: "warning-issue",
      title: "Warning",
      summary: { concept: "duplicate-rules", severity: "warning", kind: "DuplicateRule", ruleId: entry.ruleId, count: entry.count },
      items: [{ message: `Rule #${entry.ruleId} has ${entry.count} duplicates` }],
      raw: { nodeId, issue: entry },
    };
  }

  function computeFirstUnaryByEntity() {
    const entCount = idStore.size(ConceptKind.Entity);
    const firstUnaryByEntity = new Array(entCount).fill(null);
    for (let u = 0; u < rawKb.unaryCount; u++) {
      const bitset = rawKb.unaryIndex?.[u];
      if (!bitset) continue;
      bitset.iterateSetBits((e) => {
        if (e < 0 || e >= entCount) return;
        if (firstUnaryByEntity[e] === null) firstUnaryByEntity[e] = u;
      });
    }
    return firstUnaryByEntity;
  }

  // 3. Predicate Group: p-{id} (Top level relationship)
  // This might duplicate "relations" overview but focused on one.
  const predMatch = nodeId.match(/^p-(\d+)$/);
  if (predMatch) {
    const predId = parseInt(predMatch[1], 10);
    const name = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, predId));
    const connections = [];
    
    if (predId < rawKb.relations.length) {
      const matrix = rawKb.relations[predId];
      if (matrix) {
        for (let s = 0; s < matrix.rows.length; s++) {
          const row = matrix.rows[s];
          if (!row) continue;
          const subj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s));
          // Only collect stats or a limited list? Request says "Table: Full list".
          // Be careful with large KBs.
          row.iterateSetBits((o) => {
             const obj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, o));
             connections.push({ subject: subj, object: obj, subjectId: s, objectId: o });
          });
        }
      }
    }

    return {
      kind: "scoped-predicate",
      title: `Predicate: ${name}`,
      summary: { count: connections.length },
      items: connections.map(({ subject, object }) => ({ subject, object })),
      raw: { nodeId, predId, predicate: name, connections },
    };
  }

  // 4. Predicate Category Group: p-{id}-c-{none|unaryId}
  const catMatch = nodeId.match(/^p-(\d+)-c-(none|\d+)$/);
  if (catMatch) {
    const predId = parseInt(catMatch[1], 10);
    const catKey = catMatch[2];
    const catId = catKey === "none" ? null : parseInt(catKey, 10);
    const predName = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, predId));
    const catName = catId === null ? "(uncategorized)" : NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, catId));
    const firstUnaryByEntity = computeFirstUnaryByEntity();
    const connections = [];

    if (predId < rawKb.relations.length) {
      const matrix = rawKb.relations[predId];
      if (matrix) {
        for (let s = 0; s < matrix.rows.length; s++) {
          const row = matrix.rows[s];
          if (!row) continue;
          const first = firstUnaryByEntity[s] ?? null;
          if ((catId === null && first !== null) || (catId !== null && first !== catId)) continue;
          const subj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, s));
          row.iterateSetBits((o) => {
            const obj = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, o));
            connections.push({ subject: subj, subjectId: s, object: obj, objectId: o });
          });
        }
      }
    }

    return {
      kind: "scoped-rel-category",
      title: `${predName} — ${catName}`,
      summary: { count: connections.length, predicate: predName, category: catName },
      items: connections.map(({ subject, object }) => ({ subject, object })),
      raw: { nodeId, predId, predName, catId, catName, connections },
    };
  }

  // 5. Subject Group: p-{id}-c-{none|unaryId}-s-{subjectId}
  const subjMatch = nodeId.match(/^p-(\d+)-c-(none|\d+)-s-(\d+)$/);
  if (subjMatch) {
    const predId = parseInt(subjMatch[1], 10);
    const catKey = subjMatch[2];
    const subjectId = parseInt(subjMatch[3], 10);
    const firstUnaryByEntity = computeFirstUnaryByEntity();
    const subjectFirst = firstUnaryByEntity[subjectId] ?? null;
    const expectedCatId = catKey === "none" ? null : parseInt(catKey, 10);
    if ((expectedCatId === null && subjectFirst !== null) || (expectedCatId !== null && subjectFirst !== expectedCatId)) {
      return null;
    }

    const predName = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, predId));
    const subjName = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, subjectId));
    const objects = [];

    if (predId < rawKb.relations.length) {
      const matrix = rawKb.relations[predId];
      if (matrix) {
        const row = matrix.rows[subjectId];
        if (row) {
          row.iterateSetBits((o) => {
            objects.push({ id: o, name: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, o)) });
          });
        }
      }
    }

    return {
      kind: "scoped-subject",
      title: `${subjName} ${predName}...`,
      summary: { count: objects.length },
      items: objects.map((o) => o.name),
      raw: { nodeId, predId, predName, subjectId, subject: subjName, objects },
    };
  }

  // 6. Relationship Fact: p-{id}-c-{none|unaryId}-s-{subjectId}-o-{objectId}
  const factMatch = nodeId.match(/^p-(\d+)-c-(none|\d+)-s-(\d+)-o-(\d+)$/);
  if (factMatch) {
    const predId = parseInt(factMatch[1], 10);
    const catKey = factMatch[2];
    const subjectId = parseInt(factMatch[3], 10);
    const objectId = parseInt(factMatch[4], 10);
    const firstUnaryByEntity = computeFirstUnaryByEntity();
    const subjectFirst = firstUnaryByEntity[subjectId] ?? null;
    const expectedCatId = catKey === "none" ? null : parseInt(catKey, 10);
    if ((expectedCatId === null && subjectFirst !== null) || (expectedCatId !== null && subjectFirst !== expectedCatId)) {
      return null;
    }

    const predName = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, predId));
    const subjName = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, subjectId));
    const objName = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, objectId));

    const exists =
      predId < rawKb.relations.length &&
      rawKb.relations[predId] &&
      rawKb.relations[predId].rows &&
      rawKb.relations[predId].rows[subjectId] &&
      safeHasBit(rawKb.relations[predId].rows[subjectId], objectId);

    return {
      kind: "relation-fact",
      title: "Relationship Fact",
      summary: { exists, sentence: `${subjName} ${predName} ${objName}` },
      items: [],
      raw: { nodeId, predId, predName, subjectId, subject: subjName, objectId, object: objName, exists },
    };
  }

  return null;
}

export function buildOverview(kind, context) {
  const k = String(kind || "").toLowerCase();
  const { rawKb, idStore, ruleStore, actionStore, session } = context;

  if (k === "things") {
    const items = collectThings(rawKb, idStore);
    return {
      kind: "things",
      title: "Things",
      summary: { count: items.length },
      items,
      raw: {
        count: items.length,
        entityIds: items.map((i) => i.id),
        degrees: items.map((i) => ({ id: i.id, degree: i.degree, out: i.outDegree, in: i.inDegree })),
      },
    };
  }
  if (k === "concepts") {
    const items = collectConcepts(rawKb, idStore);
    return {
      kind: "concepts",
      title: "Concepts",
      summary: { count: items.length },
      items,
      raw: { count: items.length, unaryIds: items.map((i) => i.id) },
    };
  }
  if (k === "relations") {
    const items = collectRelations(rawKb, idStore);
    return {
      kind: "relations",
      title: "Relations",
      summary: { count: items.length },
      items,
      raw: { count: items.length, predicateIds: items.map((i) => i.id) },
    };
  }
  if (k === "rules") {
    const { items, duplicates, transitions } = collectRules(ruleStore, idStore);
    const groups = new Map(); // groupId -> { groupId, label, count }
    const rules = ruleStore.getRules();
    rules.forEach((rule, idx) => {
      if (!rule) return;
      if (rule.kind === "TransitionRule" || rule.kind === "TransitionRuleStatement") return;
      const unaryIds = rule?.deps?.unaryIds;
      const predIds = rule?.deps?.predIds;
      let groupId = "rule-group-general";
      let label = "general";
      if (unaryIds && unaryIds.size > 0) {
        const minUnary = Math.min(...[...unaryIds]);
        groupId = `rule-group-u-${minUnary}`;
        label = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, minUnary));
      } else if (predIds && predIds.size > 0) {
        const minPred = Math.min(...[...predIds]);
        groupId = `rule-group-p-${minPred}`;
        label = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, minPred));
      }
      const entry = groups.get(groupId) ?? { groupId, label, count: 0, ruleIds: [] };
      entry.count += 1;
      entry.ruleIds.push(idx);
      groups.set(groupId, entry);
    });
    const ruleGroups = [...groups.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label));
    return {
      kind: "rules",
      title: "Rules",
      summary: { count: items.length, duplicates: duplicates.length, transitions },
      items,
      duplicates,
      raw: { count: items.length, duplicates: duplicates.length, transitions, ruleGroups },
    };
  }
  if (k === "transitions") {
    const items = collectTransitions(ruleStore);
    return {
      kind: "transitions",
      title: "Transitions",
      summary: { count: items.length },
      items,
      raw: { count: items.length, ruleIds: items.map((i) => i.id) },
    };
  }
  if (k === "symbols") {
    const items = collectSymbols(rawKb, idStore);
    return {
      kind: "symbols",
      title: "Symbols",
      summary: { count: items.length },
      items,
      raw: { count: items.length, entityIds: items.map((i) => i.id) },
    };
  }
  if (k === "actions") {
    const items = collectActions(actionStore);
    return {
      kind: "actions",
      title: "Actions",
      summary: { count: items.length },
      items,
      raw: { count: items.length, actionIds: items.map((i) => i.id) },
    };
  }
  if (k === "warnings") {
    const issues = [];
    const dictWarnings = session?.state?.dictionary?.warnings || [];
    dictWarnings.forEach((w, idx) => {
      issues.push({
        source: "dictionary",
        leafId: `w-issue-dict-${idx}`,
        severity: w.severity || "warning",
        kind: w.kind || "DictionaryWarning",
        key: w.key || "general",
        message: w.message || "(no message)",
      });
    });

    const ruleDups = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
    ruleDups.forEach((d) => {
      issues.push({
        source: "rules",
        leafId: `w-issue-dupRule-${d.ruleId}`,
        severity: "warning",
        kind: "DuplicateRule",
        key: "duplicate-rules",
        message: `Rule #${d.ruleId} has ${d.count} duplicates`,
        ruleId: d.ruleId,
        count: d.count,
      });
    });

    const groups = new Map(); // sev:kind -> { severity, kind, count, keys:Set, nodeId }
    for (const i of issues) {
      const severity = i.severity === "error" ? "error" : "warning";
      const kind = String(i.kind || "UnknownIssue");
      const groupKey = `${severity}:${kind}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          severity,
          kind,
          count: 0,
          keys: new Set(),
          nodeId: `w-kind-${severity}-${encodeURIComponent(kind)}`,
        });
      }
      const g = groups.get(groupKey);
      g.count += 1;
      g.keys.add(i.key || "general");
    }

    const items = [...groups.values()]
      .map((g) => ({
        severity: g.severity,
        kind: g.kind,
        count: g.count,
        keyCount: g.keys.size,
        nodeId: g.nodeId,
        sampleKeys: [...g.keys].slice(0, 12),
      }))
      .sort((a, b) => {
        const sevRank = (s) => (s === "error" ? 0 : 1);
        if (sevRank(a.severity) !== sevRank(b.severity)) return sevRank(a.severity) - sevRank(b.severity);
        if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0);
        return String(a.kind).localeCompare(String(b.kind));
      });

    const totalCount = issues.length;
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = totalCount - errorCount;

    return {
      kind: "warnings",
      title: "Issues",
      summary: { count: totalCount, groupCount: items.length, errors: errorCount, warnings: warningCount },
      items,
      raw: { totalCount, errorCount, warningCount, items, issues },
    };
  }
  if (k === "knowledge") {
    const stats = {
      things: collectThings(rawKb, idStore).length,
      concepts: collectConcepts(rawKb, idStore).length,
      relations: collectRelations(rawKb, idStore).length,
      rules: ruleStore.getRules().filter(r => r.kind !== "TransitionRule" && r.kind !== "TransitionRuleStatement").length,
      transitions: collectTransitions(ruleStore).length,
      actions: actionStore.getActions().length,
      warnings: (session?.state?.dictionary?.warnings?.length || 0) + (typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules().length : 0)
    };
    return { kind: "knowledge", title: "Knowledge Base Summary", summary: stats, items: [], raw: { stats } };
  }
  return null;
}
