import { ConceptKind, NLG, bitsetPopcount, getName, json, safeHasBit, describeRuleNL, describeTransitionRuleNL } from "../helpers.mjs";

export function handleTree(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/tree") return false;
  const tree = buildTree(context);
  json(res, 200, { tree });
  return true;
}

export function buildTree(context) {
  const { rawKb, idStore, ruleStore, actionStore, session } = context;
  const tree = [];

  function openOverview(kind, id = "") {
    return { type: "overview", kind, id };
  }

  function openEntity(entityType, id) {
    return { type: "entity", entityType, id };
  }

  function lookupKey(kind, denseId) {
    const cid = idStore.getConceptualId(kind, denseId);
    return cid === undefined ? null : idStore.lookupKey(cid);
  }

  function getEntityCategories(entityId) {
    const cats = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], entityId)) {
        cats.push(NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u)));
      }
    }
    return cats;
  }

  const entCount = idStore.size(ConceptKind.Entity);
  const thingIds = [];
  const symbolIds = [];
  for (let i = 0; i < entCount; i++) {
    const key = lookupKey(ConceptKind.Entity, i) || "";
    if (key.startsWith("L:") || key.startsWith("E:lit:")) {
      symbolIds.push(i);
    } else {
      thingIds.push(i);
    }
  }

  const entNode = {
    id: "things",
    text: `👥 Things (${thingIds.length})`,
    children: [],
    icon: "folder",
    expanded: thingIds.length <= 10,
    tooltip: "Concrete named individuals (things) in the current session.",
    open: openOverview("things"),
  };
  for (const i of thingIds) {
    const name = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, i));
    const cats = getEntityCategories(i);
    const catSummary =
      cats.length > 0 ? ` — ${cats.slice(0, 2).join(", ")}${cats.length > 2 ? "..." : ""}` : "";
    entNode.children.push({
      id: `e-${i}`,
      text: `${name}${catSummary}`,
      icon: "user",
      type: "entity",
      denseId: i,
      name: name,
      categories: cats,
      open: openEntity("entity", i),
    });
  }
  tree.push(entNode);

  const catNode = {
    id: "concepts",
    text: `🏷️ concepts (${rawKb.unaryCount})`,
    children: [],
    icon: "folder",
    tooltip: "Unary predicates (types/categories) and symbols used as constants.",
    open: openOverview("concepts"),
  };

  if (symbolIds.length > 0) {
    catNode.children.push({
      id: "symbols",
      text: `🔤 symbols (${symbolIds.length})`,
      tooltip: "Symbolic constants and literals (lower-case tokens and literal values).",
      children: symbolIds.map((i) => {
        const name = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, i));
        return {
          id: `s-${i}`,
          text: name,
          icon: "tag",
          type: "entity",
          denseId: i,
          name,
          open: openEntity("entity", i),
        };
      }),
      icon: "folder",
      expanded: symbolIds.length <= 10,
      open: openOverview("symbols"),
    });
  }

  const unaryTotal = idStore.size(ConceptKind.UnaryPredicate);
  for (let i = 0; i < unaryTotal; i++) {
    const bitset = i < rawKb.unaryIndex.length ? rawKb.unaryIndex[i] : null;
    const count = bitset ? bitset.popcount() : 0;
    const name = getName(idStore, ConceptKind.UnaryPredicate, i);
    const isUserDefined = name && !name.startsWith("[");

    if (isUserDefined || count > 0) {
      const cleanName = NLG.formatCategory(name);
      const memberText = count === 1 ? "1 member" : `${count} members`;
      catNode.children.push({
        id: `u-${i}`,
        text: `${cleanName} — ${memberText}`,
        icon: "tag",
        type: "unary",
        denseId: i,
        name: cleanName,
        memberCount: count,
        open: openEntity("unary", i),
      });
    }
  }
  tree.push(catNode);

  const predTotal = idStore.size(ConceptKind.Predicate);
  let totalConnections = 0;
  const relChildren = [];

  const firstUnaryByEntity = new Array(entCount).fill(null);
  const unaryNameCache = new Map();
  for (let u = 0; u < rawKb.unaryCount; u++) {
    const name = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u));
    unaryNameCache.set(u, name);
    const bitset = rawKb.unaryIndex?.[u];
    if (!bitset) continue;
    bitset.iterateSetBits((e) => {
      if (e < 0 || e >= entCount) return;
      if (firstUnaryByEntity[e] === null) firstUnaryByEntity[e] = u;
    });
  }

  for (let i = 0; i < predTotal; i++) {
    let linkCount = 0;
    const categoryGroups = new Map(); // catKey -> { catId, name, linkCount, subjects: Map(subjectId -> Set(objectId)) }
    if (i < rawKb.relations.length) {
      const matrix = rawKb.relations[i];
      if (matrix) {
        const subjectLimit = Math.min(entCount, matrix.rows.length);
        for (let s = 0; s < subjectLimit; s++) {
          const row = matrix.rows[s];
          if (!row || row.isEmpty?.()) continue;

          const catId = firstUnaryByEntity[s];
          const catKey = catId === null ? "none" : String(catId);
          const catName = catId === null ? "(uncategorized)" : unaryNameCache.get(catId) || `(concept #${catId})`;
          if (!categoryGroups.has(catKey)) {
            categoryGroups.set(catKey, { catId, name: catName, linkCount: 0, subjects: new Map() });
          }

          row.iterateSetBits((o) => {
            if (o < 0 || o >= entCount) return;
            linkCount += 1;
            const group = categoryGroups.get(catKey);
            group.linkCount += 1;
            if (!group.subjects.has(s)) group.subjects.set(s, new Set());
            group.subjects.get(s).add(o);
          });
        }
      }
    }
    totalConnections += linkCount;

    const name = getName(idStore, ConceptKind.Predicate, i);
    const isUserDefined = name && !name.startsWith("[");

    if (isUserDefined || linkCount > 0) {
      const cleanName = NLG.formatPredicate(name);
      const connText = linkCount === 1 ? "1 connection" : `${linkCount} connections`;
      
      const categoryChildren = [...categoryGroups.entries()]
        .map(([catKey, group]) => ({ catKey, group }))
        .sort((a, b) => (b.group.linkCount ?? 0) - (a.group.linkCount ?? 0) || String(a.group.name).localeCompare(String(b.group.name)));

      const groupNodes = categoryChildren.map(({ catKey, group }) => {
        const subjectNodes = [...group.subjects.entries()]
          .map(([subjectId, objectIds]) => ({ subjectId, objectIds }))
          .sort((a, b) => {
            const an = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, a.subjectId));
            const bn = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, b.subjectId));
            return an.localeCompare(bn);
          })
          .map(({ subjectId, objectIds }) => {
            const subjName = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, subjectId));
            const objects = [...objectIds]
              .map((objectId) => ({
                objectId,
                name: NLG.formatEntityName(getName(idStore, ConceptKind.Entity, objectId)),
              }))
              .sort((a, b) => a.name.localeCompare(b.name));

            return {
              id: `p-${i}-c-${catKey}-s-${subjectId}`,
              text: `${subjName} (${objects.length})`,
              icon: "user",
              open: openOverview("scoped", `p-${i}-c-${catKey}-s-${subjectId}`),
              children: objects.map((obj) => ({
                id: `p-${i}-c-${catKey}-s-${subjectId}-o-${obj.objectId}`,
                text: obj.name,
                icon: "tag",
                open: openOverview("scoped", `p-${i}-c-${catKey}-s-${subjectId}-o-${obj.objectId}`),
              })),
            };
          });

        return {
          id: `p-${i}-c-${catKey}`,
          text: `${group.name} (${group.linkCount})`,
          icon: "folder",
          open: openOverview("scoped", `p-${i}-c-${catKey}`),
          children: subjectNodes,
        };
      });

      relChildren.push({
        id: `p-${i}`,
        text: `${cleanName} — ${connText}`,
        icon: "link",
        type: "predicate",
        denseId: i,
        name: cleanName,
        connectionCount: linkCount,
        children: groupNodes,
        expanded: false,
        open: openOverview("scoped", `p-${i}`),
      });
    }
  }
  if (predTotal > 0) {
    tree.push({
      id: "relations",
      text: `🔗 relationships (${predTotal})` + (totalConnections > 0 ? ` — ${totalConnections} links` : ""),
      children: relChildren,
      icon: "folder",
      tooltip: "Binary predicates (relationships) and their connections.",
      open: openOverview("relations"),
    });
  }

  const rules = ruleStore.getRules();
  if (rules.length > 0) {
    const deductive = [];
    const transitions = [];

    rules.forEach((rule, idx) => {
      if (rule?.kind === "TransitionRule" || rule?.kind === "TransitionRuleStatement") {
        transitions.push({ rule, idx });
      } else {
        deductive.push({ rule, idx });
      }
    });

    if (deductive.length > 0) {
      const ruleGroups = new Map(); // groupId -> { label, items: [] }

      deductive.forEach(({ rule, idx }) => {
        let groupId = "rule-group-general";
        let label = "general";
        const unaryIds = rule?.deps?.unaryIds;
        const predIds = rule?.deps?.predIds;
        if (unaryIds && unaryIds.size > 0) {
          const minUnary = Math.min(...[...unaryIds]);
          groupId = `rule-group-u-${minUnary}`;
          label = NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, minUnary));
        } else if (predIds && predIds.size > 0) {
          const minPred = Math.min(...[...predIds]);
          groupId = `rule-group-p-${minPred}`;
          label = NLG.formatPredicate(getName(idStore, ConceptKind.Predicate, minPred));
        }

        let tooltip = `Rule #${idx}`;
        try {
          tooltip = describeRuleNL(rule, idStore);
        } catch {}

        if (!ruleGroups.has(groupId)) ruleGroups.set(groupId, { label, items: [] });
        ruleGroups.get(groupId).items.push({
          id: `r-${idx}`,
          text: tooltip, // Use the natural language description as text for better grouping
          tooltip,
          icon: "rule",
          type: "rule",
          denseId: idx,
          open: openEntity("rule", idx),
        });
      });

      const ruleNode = {
        id: "rules",
        text: `📋 rules (${deductive.length})`,
        children: [...ruleGroups.entries()]
          .map(([groupId, entry]) => ({
            id: groupId,
            text: `${entry.label} (${entry.items.length} ${entry.items.length === 1 ? "rule" : "rules"})`,
            icon: "folder",
            open: openOverview("scoped", groupId),
            children: entry.items,
          }))
          .sort((a, b) => a.text.localeCompare(b.text)),
        icon: "folder",
        tooltip: "Deductive rules (materialized by deduction).",
        open: openOverview("rules"),
      };
      tree.push(ruleNode);
    }

    if (transitions.length > 0) {
      const transNode = {
        id: "transitions",
        text: `🔁 transitions (${transitions.length})`,
        children: [],
        icon: "folder",
        tooltip: "Simulation transitions (used only by Simulate).",
        open: openOverview("transitions"),
      };
      transitions.forEach(({ rule, idx }) => {
        const rendered = describeTransitionRuleNL(rule);
        const tooltip = rendered?.natural ?? `Transition #${idx}`;
        transNode.children.push({
          id: `t-${idx}`,
          text: tooltip,
          tooltip,
          icon: "rule",
          type: "rule",
          denseId: idx,
          open: openEntity("rule", idx),
        });
      });
      tree.push(transNode);
    }
  }

  const actions = actionStore.getActions();
  if (actions.length > 0) {
    const actionNode = {
      id: "actions",
      text: `⚡ actions (${actions.length})`,
      children: [],
      icon: "folder",
      tooltip: "Planning operators (Action blocks): agent constraint + preconditions + effects.",
      open: openOverview("actions"),
    };
    actions.forEach((action, idx) => {
      const name = action.action ? String(action.action).trim() : action.name ? action.name.value : `Action #${idx}`;
      const agent = action.agent ? String(action.agent).trim() : "";
      const pre = Array.isArray(action.preconditions) ? action.preconditions.length : 0;
      const eff = Array.isArray(action.effects) ? action.effects.length : 0;
      const tooltipParts = [];
      if (agent) tooltipParts.push(`Agent: ${agent}`);
      tooltipParts.push(`Preconditions: ${pre}`);
      tooltipParts.push(`Effects: ${eff}`);
      actionNode.children.push({
        id: `a-${idx}`,
        text: name,
        icon: "action",
        type: "action",
        denseId: idx,
        tooltip: tooltipParts.join(" | "),
        open: openEntity("action", idx),
      });
    });
    tree.push(actionNode);
  }

  const dictWarnings = session?.state?.dictionary?.warnings || [];
  const dupRules = typeof ruleStore.getDuplicateRules === "function" ? ruleStore.getDuplicateRules() : [];
  
  if (dictWarnings.length > 0 || dupRules.length > 0) {
    tree.push({
      id: "warnings",
      text: `⚠️ issues (${dictWarnings.length + dupRules.length})`,
      children: [],
      icon: "folder",
      expanded: true,
      tooltip: "Potential issues: duplicate rules, ambiguous dictionary entries, contradictions.",
      open: openOverview("warnings"),
    });

    const warningNode = tree[tree.length - 1];

    const issues = [];
    dictWarnings.forEach((w, idx) => {
      issues.push({
        severity: w.severity || "warning",
        kind: w.kind || "DictionaryWarning",
        key: w.key || "general",
        leafId: `w-issue-dict-${idx}`,
        text: w.message || "(no message)",
        tooltip: `Kind: ${w.kind} | Severity: ${w.severity}`,
      });
    });
    dupRules.forEach((d) => {
      issues.push({
        severity: "warning",
        kind: "DuplicateRule",
        key: "duplicate-rules",
        leafId: `w-issue-dupRule-${d.ruleId}`,
        text: `Rule #${d.ruleId} has ${d.count} duplicates`,
        tooltip: "Duplicate rules can cause redundant computation.",
      });
    });

    const bySeverity = new Map(); // severity -> Map(kind -> Map(key -> [leafNodes]))
    for (const issue of issues) {
      const severity = issue.severity === "error" ? "error" : "warning";
      if (!bySeverity.has(severity)) bySeverity.set(severity, new Map());
      const byKind = bySeverity.get(severity);
      if (!byKind.has(issue.kind)) byKind.set(issue.kind, new Map());
      const byKey = byKind.get(issue.kind);
      if (!byKey.has(issue.key)) byKey.set(issue.key, []);

      byKey.get(issue.key).push({
        id: issue.leafId,
        text: issue.text,
        tooltip: issue.tooltip,
        icon: "alert",
        open: openOverview("scoped", issue.leafId),
      });
    }

    const severityOrder = ["error", "warning"];
    for (const sev of severityOrder) {
      const kindMap = bySeverity.get(sev);
      if (!kindMap) continue;
      const total = [...kindMap.values()].reduce((sum, keyMap) => sum + [...keyMap.values()].reduce((s, arr) => s + arr.length, 0), 0);
      const sevId = `w-sev-${sev}`;
      const sevNode = {
        id: sevId,
        text: `${sev === "error" ? "❌ Errors" : "⚠️ Warnings"} (${total})`,
        icon: "folder",
        open: openOverview("scoped", sevId),
        children: [],
      };

      const kindNodes = [...kindMap.entries()]
        .map(([kind, keyMap]) => {
          const kindEnc = encodeURIComponent(kind);
          const kindId = `w-kind-${sev}-${kindEnc}`;
          const count = [...keyMap.values()].reduce((s, arr) => s + arr.length, 0);
          const conceptNodes = [...keyMap.entries()]
            .map(([key, leaves]) => {
              const keyEnc = encodeURIComponent(key);
              const kcId = `w-kc-${sev}-${kindEnc}-c-${keyEnc}`;
              return {
                id: kcId,
                text: `${key} (${leaves.length})`,
                icon: "folder",
                open: openOverview("scoped", kcId),
                children: leaves,
              };
            })
            .sort((a, b) => a.text.localeCompare(b.text));

          return {
            id: kindId,
            text: `${kind} (${count})`,
            icon: "folder",
            open: openOverview("scoped", kindId),
            children: conceptNodes,
          };
        })
        .sort((a, b) => a.text.localeCompare(b.text));

      sevNode.children = kindNodes;
      warningNode.children.push(sevNode);
    }
  }

  return tree;
}
