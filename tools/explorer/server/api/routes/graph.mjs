import {
  ConceptKind,
  NLG,
  describeHeadNL,
  describeRuleNL,
  describeSetPlanNL,
  getName,
  json,
  safeHasBit,
} from "../helpers.mjs";

// Extract concept IDs from a rule body (SetPlan)
function extractBodyConcepts(plan, concepts = new Set()) {
  if (!plan) return concepts;
  if (plan.op === "UnarySet") concepts.add(plan.unaryId);
  if (plan.op === "Intersect" || plan.op === "Union") {
    (plan.plans ?? []).forEach((p) => extractBodyConcepts(p, concepts));
  }
  if (plan.op === "Not") extractBodyConcepts(plan.plan, concepts);
  if (plan.op === "Image") extractBodyConcepts(plan.subjectSet, concepts);
  if (plan.op === "Preimage") extractBodyConcepts(plan.objectSet, concepts);
  if (plan.op === "AttrEntityFilter") extractBodyConcepts(plan.valueSet, concepts);
  return concepts;
}

// Extract concept ID from rule head
function extractHeadConcept(head) {
  if (!head) return null;
  if (head.kind === "UnaryEmit") return head.unaryId;
  return null;
}

// Get concept name from idStore by unary ID
function getConceptName(idStore, unaryId) {
  const cid = idStore.getConceptualId(ConceptKind.UnaryPredicate, unaryId);
  if (cid === undefined) return null;
  const key = idStore.lookupKey(cid);
  if (!key || key.startsWith("[")) return null;
  return NLG.formatCategory(key.replace(/^U:/, ""));
}

export function buildGraph(context) {
  const { rawKb, idStore, ruleStore, actionStore } = context;

  const nodes = [];
  const edges = [];
  let edgeId = 0;

  const entCount = idStore.size(ConceptKind.Entity);
  const entityKeys = [];
  for (let i = 0; i < entCount; i++) {
    const cid = idStore.getConceptualId(ConceptKind.Entity, i);
    entityKeys[i] = cid === undefined ? "" : idStore.lookupKey(cid) || "";
  }
  
  // Collect rules and actions text for info popups
  const rules = ruleStore.getRules();
  const rulesText = rules.map((rule, idx) => {
    try {
      return describeRuleNL(rule, idStore);
    } catch { return `Rule #${idx}`; }
  });
  
  const actions = actionStore.getActions();
  const actionsText = actions.map((action, idx) => {
    const name = action.name ? action.name.value : `Action #${idx}`;
    const agent = action.agent ? `Agent: ${action.agent.head || 'any'}` : '';
    const precond = action.precondition ? `Precondition: ${describeSetPlanNL(action.precondition, idStore)}` : '';
    const effect = action.effect ? `Effect: ${describeHeadNL(action.effect, idStore)}` : '';
    const parts = [name, agent, precond, effect].filter(p => p);
    return parts.join(' | ');
  });
  
  // 1. Add Things and Symbolic Concepts (entities)
  for (let i = 0; i < entCount; i++) {
    const name = NLG.formatEntityName(getName(idStore, ConceptKind.Entity, i));
    const key = entityKeys[i] || "";
    const categories = [];
    for (let u = 0; u < rawKb.unaryCount; u++) {
      if (safeHasBit(rawKb.unaryIndex[u], i)) {
        categories.push(NLG.formatCategory(getName(idStore, ConceptKind.UnaryPredicate, u)));
      }
    }
    const isSymbol = key.startsWith("L:") || key.startsWith("E:lit:");
    nodes.push({
      id: `e${i}`,
      name,
      nodeType: isSymbol ? "symbol" : "thing",
      categories,
      icon: isSymbol ? "🏷️" : "👤",
      rulesText,
      actionsText,
    });
  }

  // 2. Add concepts (categories) with rules/actions info
  const unaryTotal = idStore.size(ConceptKind.UnaryPredicate);
  for (let u = 0; u < unaryTotal; u++) {
    const bitset = u < rawKb.unaryIndex.length ? rawKb.unaryIndex[u] : null;
    const count = bitset ? bitset.popcount() : 0;
    const rawName = getName(idStore, ConceptKind.UnaryPredicate, u);
    const isUserDefined = rawName && !rawName.startsWith("[");
    if (!isUserDefined && count === 0) continue;
    
    const name = NLG.formatCategory(rawName);
    // Attach rules/actions text to concepts
    nodes.push({ 
      id: `c${u}`, 
      name, 
      nodeType: "concept", 
      memberCount: count, 
      icon: "🏷️",
      rulesText,
      actionsText
    });
    
    // "is a" edges from things to concepts
    if (bitset) {
      for (let e = 0; e < entCount; e++) {
        if (safeHasBit(bitset, e)) {
          edges.push({ id: `e${edgeId++}`, source: `e${e}`, target: `c${u}`, label: "is a", edgeType: "isa" });
        }
      }
    }
  }

  // 3. Binary relation edges between things
  const predTotal = idStore.size(ConceptKind.Predicate);
  for (let p = 0; p < predTotal; p++) {
    const matrix = p < rawKb.relations.length ? rawKb.relations[p] : null;
    if (!matrix) continue;
    
    const rawName = getName(idStore, ConceptKind.Predicate, p);
    if (!rawName || rawName.startsWith("[")) continue;
    
    const predName = NLG.formatPredicate(rawName);
    
    for (let s = 0; s < matrix.rows.length && s < entCount; s++) {
      const row = matrix.rows[s];
      if (!row) continue;
      for (let o = 0; o < entCount; o++) {
        if (safeHasBit(row, o)) {
          edges.push({ id: `e${edgeId++}`, source: `e${s}`, target: `e${o}`, label: predName, edgeType: "relation" });
        }
      }
    }
  }

  // 4. Add rule dependency edges (body concepts → head concept)
  // Also collect all concepts mentioned in rules to create nodes
  const ruleConcepts = new Map(); // unaryId -> name
  for (const rule of rules) {
    const bodyConcepts = extractBodyConcepts(rule.body);
    const headConcept = extractHeadConcept(rule.head);
    
    // Collect concept names
    for (const cid of bodyConcepts) {
      if (!ruleConcepts.has(cid)) {
        const name = getConceptName(idStore, cid);
        if (name) ruleConcepts.set(cid, name);
      }
    }
    if (headConcept !== null && !ruleConcepts.has(headConcept)) {
      const name = getConceptName(idStore, headConcept);
      if (name) ruleConcepts.set(headConcept, name);
    }
    
    if (headConcept !== null) {
      for (const bodyConceptId of bodyConcepts) {
        edges.push({ 
          id: `e${edgeId++}`, 
          source: `c${bodyConceptId}`, 
          target: `c${headConcept}`, 
          label: "implies", 
          edgeType: "rule" 
        });
      }
    }
  }

  // 5. Add concept nodes from rules (if not already added from KB)
  const existingConcepts = new Set(nodes.filter(n => n.nodeType === "concept").map(n => n.id));
  for (const [cid, name] of ruleConcepts) {
    const nodeId = `c${cid}`;
    if (!existingConcepts.has(nodeId)) {
      nodes.push({ id: nodeId, name, nodeType: "concept", memberCount: 0, icon: "🏷️" });
    }
  }

  return { nodes, edges, rulesText, actionsText };
}

export function handleGraph(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/graph") return false;
  const graph = buildGraph(context);
  json(res, 200, { ok: true, graph });
  return true;
}
