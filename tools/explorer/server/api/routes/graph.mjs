import { ConceptKind, NLG, getName, json, safeHasBit, describeSetPlanNL, describeHeadNL } from "../helpers.mjs";

// Extract concept IDs from a rule body (SetPlan)
function extractBodyConcepts(plan, concepts = new Set()) {
  if (!plan) return concepts;
  if (plan.op === "UnarySet") concepts.add(plan.unaryId);
  if (plan.op === "Intersect" || plan.op === "Union") {
    plan.plans.forEach(p => extractBodyConcepts(p, concepts));
  }
  if (plan.op === "Not") extractBodyConcepts(plan.plan, concepts);
  return concepts;
}

// Extract concept ID from rule head
function extractHeadConcept(head) {
  if (!head) return null;
  if (head.kind === "UnaryEmit") return head.unaryId;
  return null;
}

export function handleGraph(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/graph") return false;
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
      const cond = describeSetPlanNL(rule.body, idStore);
      const effect = describeHeadNL(rule.head, idStore);
      return `If ${cond} then ${effect}`;
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
  for (let u = 0; u < rawKb.unaryCount; u++) {
    const bitset = rawKb.unaryIndex[u];
    const count = bitset ? bitset.popcount() : 0;
    const rawName = getName(idStore, ConceptKind.UnaryPredicate, u);
    if (!rawName || rawName.startsWith("[")) continue;
    
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
  for (let p = 0; p < rawKb.predicatesCount; p++) {
    const matrix = rawKb.relations[p];
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
  // This creates the topological ordering: if "Every X is Y" then Y depends on X
  for (const rule of rules) {
    const bodyConcepts = extractBodyConcepts(rule.body);
    const headConcept = extractHeadConcept(rule.head);
    if (headConcept !== null) {
      for (const bodyConceptId of bodyConcepts) {
        // Edge from body concept to head concept (head depends on body)
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

  json(res, 200, { ok: true, graph: { nodes, edges, rulesText, actionsText } });
  return true;
}
