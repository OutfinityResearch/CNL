import { ConceptKind, NLG, bitsetPopcount, getName, json, safeHasBit, describeRuleNL } from "../helpers.mjs";

export function handleTree(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/tree") return false;
  const { rawKb, idStore, ruleStore, actionStore } = context;
  const tree = [];

  function lookupKey(kind, denseId) {
    const cid = idStore.getConceptualId(kind, denseId);
    return cid === undefined ? null : idStore.lookupKey(cid);
  }

  function getEntityCategories(entityId) {
    const cats = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], entityId)) {
        cats.push(getName(idStore, ConceptKind.UnaryPredicate, u));
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
  };
  for (const i of thingIds) {
    const name = getName(idStore, ConceptKind.Entity, i);
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
    });
  }
  tree.push(entNode);

  const catNode = {
    id: "concepts",
    text: `🏷️ concepts (${rawKb.unaryCount})`,
    children: [],
    icon: "folder",
  };

  if (symbolIds.length > 0) {
    catNode.children.push({
      id: "symbols",
      text: `🔤 symbols (${symbolIds.length})`,
      children: symbolIds.map((i) => {
        const name = getName(idStore, ConceptKind.Entity, i);
        return {
          id: `s-${i}`,
          text: name,
          icon: "tag",
          type: "symbol",
          denseId: i,
          name,
        };
      }),
      icon: "folder",
      expanded: symbolIds.length <= 10,
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
      });
    }
  }
  tree.push(catNode);

  const predTotal = idStore.size(ConceptKind.Predicate);
  let totalConnections = 0;
  const relChildren = [];
  for (let i = 0; i < predTotal; i++) {
    let linkCount = 0;
    const connections = [];
    if (i < rawKb.relations.length) {
      const matrix = rawKb.relations[i];
      if (matrix) {
        for (let s = 0; s < matrix.rows.length; s++) {
          const row = matrix.rows[s];
          if (!row) continue;
          for (let o = 0; o < entCount; o++) {
            if (safeHasBit(row, o)) {
              linkCount++;
              if (connections.length < 5) {
                const subj = getName(idStore, ConceptKind.Entity, s);
                const obj = getName(idStore, ConceptKind.Entity, o);
                connections.push(`${subj} → ${obj}`);
              }
            }
          }
        }
      }
    }
    totalConnections += linkCount;

    const name = getName(idStore, ConceptKind.Predicate, i);
    const isUserDefined = name && !name.startsWith("[");

    if (isUserDefined || linkCount > 0) {
      const cleanName = NLG.formatPredicate(name);
      const connText = linkCount === 1 ? "1 connection" : `${linkCount} connections`;
      const tooltip = connections.length > 0 
        ? `${cleanName}: ${connections.join(", ")}${linkCount > 5 ? "..." : ""}`
        : cleanName;
      relChildren.push({
        id: `p-${i}`,
        text: `${cleanName} — ${connText}`,
        tooltip,
        icon: "link",
        type: "predicate",
        denseId: i,
        name: cleanName,
        connectionCount: linkCount,
      });
    }
  }
  if (predTotal > 0) {
    tree.push({
      id: "relations",
      text: `🔗 relationships (${predTotal})` + (totalConnections > 0 ? ` — ${totalConnections} links` : ""),
      children: relChildren,
      icon: "folder",
    });
  }

  const rules = ruleStore.getRules();
  if (rules.length > 0) {
    const ruleNode = {
      id: "rules",
      text: `📋 rules (${rules.length})`,
      children: [],
      icon: "folder",
    };
    rules.forEach((rule, idx) => {
      let tooltip = `Rule #${idx}`;
      try {
        tooltip = describeRuleNL(rule, idStore);
      } catch {}
      ruleNode.children.push({
        id: `r-${idx}`,
        text: `Rule #${idx}`,
        tooltip,
        icon: "rule",
        type: "rule",
        denseId: idx,
      });
    });
    tree.push(ruleNode);
  }

  const actions = actionStore.getActions();
  if (actions.length > 0) {
    const actionNode = {
      id: "actions",
      text: `⚡ actions (${actions.length})`,
      children: [],
      icon: "folder",
    };
    actions.forEach((action, idx) => {
      const name = action.name ? action.name.value : `Action #${idx}`;
      actionNode.children.push({
        id: `a-${idx}`,
        text: name,
        icon: "action",
        type: "action",
        denseId: idx,
      });
    });
    tree.push(actionNode);
  }

  json(res, 200, { tree });
  return true;
}
