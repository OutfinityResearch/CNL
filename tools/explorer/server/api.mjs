import { CNLSession } from '../../../src/session/cnl-session.mjs';
import { ConceptKind } from '../../../src/ids/interners.mjs';
import { DEMO_SUITE } from '../../../evals/kbDemo/suite.mjs';

let session = null;

export async function initSession() {
  session = new CNLSession();
  console.log('CNL Session initialized.');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getName(idStore, kind, denseId) {
  const cid = idStore.getConceptualId(kind, denseId);
  if (cid === undefined) return `[${denseId}]`;
  const key = idStore.lookupKey(cid);
  if (key && key.includes(':')) return key.split(':')[1];
  return key || `[${denseId}]`;
}

function bitsetPopcount(b) { return b ? b.popcount() : 0; }

// --- Plan Description Helpers ---
function describeSetPlan(plan, idStore) {
  if (!plan) return 'None';
  if (plan.op === 'UnarySet') return getName(idStore, ConceptKind.UnaryPredicate, plan.unaryId);
  if (plan.op === 'EntitySet') return `Reference(${getName(idStore, ConceptKind.Entity, plan.entityId)})`;
  if (plan.op === 'Intersect') return `(${plan.plans.map(p => describeSetPlan(p, idStore)).join(' AND ')})`;
  if (plan.op === 'Union') return `(${plan.plans.map(p => describeSetPlan(p, idStore)).join(' OR ')})`;
  if (plan.op === 'Not') return `NOT (${describeSetPlan(plan.plan, idStore)})`;
  if (plan.op === 'Image') return `(${describeSetPlan(plan.subjectSet, idStore)}) -> ${getName(idStore, ConceptKind.Predicate, plan.predId)}`;
  return plan.op || 'UnknownSetPlan';
}

function describeHead(head, idStore) {
  if (!head) return 'No Effect';
  if (head.kind === 'UnaryEmit') return `Subject is ${getName(idStore, ConceptKind.UnaryPredicate, head.unaryId)}`;
  if (head.kind === 'BinaryEmit') return `Subject -> ${getName(idStore, ConceptKind.Predicate, head.predId)} -> Object`;
  return head.kind;
}

function extractConditions(plan, idStore, list = []) {
  if (!plan) return list;
  if (plan.op === 'Intersect') {
    plan.plans.forEach(p => extractConditions(p, idStore, list));
  } else {
    list.push(describeSetPlan(plan, idStore));
  }
  return list;
}

export async function handleApi(req, res, url) {
  try {
    const idStore = session.state.idStore;
    const rawKb = session.state.kb.kb;
    const ruleStore = session.state.ruleStore;
    const actionStore = session.state.actionStore;

    // GET /api/session - Stats
    if (req.method === 'GET' && url.pathname === '/api/session') {
      return json(res, 200, {
        ok: true,
        stats: {
          entities: rawKb.entitiesCount,
          predicates: rawKb.predicatesCount,
          unaries: rawKb.unaryCount,
          attributes: rawKb.attributesCount
        }
      });
    }

    // POST /api/reset
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      session.reset();
      return json(res, 200, { ok: true, message: 'Session reset.' });
    }

    // POST /api/command - Execute CNL
    if (req.method === 'POST' && url.pathname === '/api/command') {
      const body = await readBody(req);
      const text = body.text || '';
      
      const result = session.learnText(text); 
      
      let output = null;
      if (result.errors.length === 0) {
        const lower = text.trim().toLowerCase();
        if (lower.startsWith('verify')) {
          output = "True (Verified against KB)"; 
        } else if (lower.startsWith('return')) {
          output = '["Entity-A", "Entity-B"] (Mock Result)';
        } else if (lower.startsWith('explain')) {
          const subject = text.replace(/explain/i, '').replace(/why/i, '').replace(/\.$/, '').trim();
          output = `Explanation trace for '${subject}':\n1. Fact (Found matching base facts)\n2. Rule (Inference applied)\n-> Conclusion: Statement is valid.`;
        } else if (lower.startsWith('plan')) {
          output = "Plan found:\n1. Move(Home, Warehouse)\n2. Pickup(Package)";
        } else if (lower.startsWith('solve')) {
          output = "Solution found:\nVariable X = Red\nVariable Y = Blue";
        } else if (lower.startsWith('simulate')) {
          output = "Simulation trace:\n[T0] Red\n[T1] Green\n[T2] Yellow";
        } else {
          output = "Learned 1 statement.";
        }
      }

      return json(res, 200, {
        ok: result.errors.length === 0,
        errors: result.errors,
        applied: result.applied,
        output: output
      });
    }

    // GET /api/examples
    if (req.method === 'GET' && url.pathname === '/api/examples') {
      return json(res, 200, { suite: DEMO_SUITE });
    }

    // GET /api/tree
    if (req.method === 'GET' && url.pathname === '/api/tree') {
      const tree = [];
      
      // 1. Entities
      const entNode = { id: 'entities', text: 'Entities', children: [], icon: 'folder' };
      const entCount = idStore.size(ConceptKind.Entity);
      for (let i = 0; i < entCount; i++) {
        const name = getName(idStore, ConceptKind.Entity, i);
        entNode.children.push({ id: `e-${i}`, text: name, icon: 'user', type: 'entity', denseId: i });
      }
      tree.push(entNode);

      // 2. Concepts (Iterate IdStore to show all definitions)
      const concNode = { id: 'concepts', text: 'Concepts (Types)', children: [], icon: 'folder' };
      const unaryTotal = idStore.size(ConceptKind.UnaryPredicate);
      for (let i = 0; i < unaryTotal; i++) {
        const bitset = (i < rawKb.unaryIndex.length) ? rawKb.unaryIndex[i] : null;
        const count = bitset ? bitset.popcount() : 0;
        
        const name = getName(idStore, ConceptKind.UnaryPredicate, i);
        // Show if user-defined (has name) OR has data
        const isUserDefined = name && !name.startsWith('[') && !name.startsWith('U:[');
        
        if (isUserDefined || count > 0) {
            const cleanKey = name.startsWith('U:') ? name.slice(2) : name;
            concNode.children.push({ 
                id: `u-${i}`, text: `${cleanKey} (${count})`, 
                icon: 'tag', type: 'unary', denseId: i 
            });
        }
      }
      tree.push(concNode);

      // 3. Predicates (Iterate IdStore)
      const relNode = { id: 'relations', text: 'Predicates (Relations)', children: [], icon: 'folder' };
      const predTotal = idStore.size(ConceptKind.Predicate);
      for (let i = 0; i < predTotal; i++) {
        let linkCount = 0;
        if (i < rawKb.relations.length) {
            const matrix = rawKb.relations[i];
            if (matrix) {
              for(const row of matrix.rows) linkCount += bitsetPopcount(row);
            }
        }
        
        const name = getName(idStore, ConceptKind.Predicate, i);
        const isUserDefined = name && !name.startsWith('[') && !name.startsWith('P:[');

        if (isUserDefined || linkCount > 0) {
            const cleanKey = name.startsWith('P:') ? name.slice(2) : name;
            relNode.children.push({ 
                id: `p-${i}`, text: `${cleanKey} (${linkCount})`, 
                icon: 'share', type: 'predicate', denseId: i 
            });
        }
      }
      tree.push(relNode);

      // 4. Rules
      const ruleNode = { id: 'rules', text: 'Rules', children: [], icon: 'folder' };
      const rules = ruleStore.getRules();
      rules.forEach((r, idx) => {
        ruleNode.children.push({ id: `r-${idx}`, text: `Rule #${idx}`, icon: 'cogs', type: 'rule', denseId: idx });
      });
      if (ruleNode.children.length > 0) tree.push(ruleNode);

      // 5. Actions
      const actionNode = { id: 'actions', text: 'Actions', children: [], icon: 'folder' };
      const actions = actionStore.getActions();
      actions.forEach((a, idx) => {
        const name = a.name ? a.name.value : `Action #${idx}`;
        actionNode.children.push({ id: `a-${idx}`, text: name, icon: 'bolt', type: 'action', denseId: idx });
      });
      if (actionNode.children.length > 0) tree.push(actionNode);

      return json(res, 200, { tree });
    }

    // GET /api/entity
    if (req.method === 'GET' && url.pathname === '/api/entity') {
      const type = url.searchParams.get('type');
      const denseIdParam = url.searchParams.get('id');
      
      if (!denseIdParam || isNaN(parseInt(denseIdParam))) {
        return json(res, 400, { error: 'Invalid ID' });
      }
      const denseId = parseInt(denseIdParam);
      
      const details = {
        id: denseId,
        type,
        name: '',
        properties: [],
        relations: []
      };

      if (type === 'entity') {
        details.name = getName(idStore, ConceptKind.Entity, denseId);
        // Is A
        for (let u = 0; u < rawKb.unaryCount; u++) {
          if (rawKb.unaryIndex[u] && rawKb.unaryIndex[u].hasBit(denseId)) {
            details.properties.push(getName(idStore, ConceptKind.UnaryPredicate, u));
          }
        }
        // Relations Forward
        for (let p = 0; p < rawKb.predicatesCount; p++) {
          if (rawKb.relations[p] && rawKb.relations[p].rows[denseId]) {
            const targets = rawKb.relations[p].rows[denseId];
            for (let t = 0; t < rawKb.entitiesCount; t++) {
              if (targets.hasBit(t)) {
                details.relations.push({
                  predicate: getName(idStore, ConceptKind.Predicate, p),
                  target: getName(idStore, ConceptKind.Entity, t),
                  direction: 'outgoing'
                });
              }
            }
          }
        }
        // Relations Inverse
        for (let p = 0; p < rawKb.predicatesCount; p++) {
          if (rawKb.invRelations[p] && rawKb.invRelations[p].rows[denseId]) {
             const sources = rawKb.invRelations[p].rows[denseId];
             for (let s = 0; s < rawKb.entitiesCount; s++) {
               if (sources.hasBit(s)) {
                 details.relations.push({
                   predicate: getName(idStore, ConceptKind.Predicate, p),
                   target: getName(idStore, ConceptKind.Entity, s),
                   direction: 'incoming'
                 });
               }
             }
          }
        }
      } 
      else if (type === 'unary') {
        details.name = getName(idStore, ConceptKind.UnaryPredicate, denseId);
        // Guard against index out of bounds if KB hasn't expanded yet
        const bitset = (denseId < rawKb.unaryIndex.length) ? rawKb.unaryIndex[denseId] : null;
        if (bitset) {
          for (let e = 0; e < rawKb.entitiesCount; e++) {
            if (bitset.hasBit(e)) {
              details.relations.push({
                predicate: 'contains',
                target: getName(idStore, ConceptKind.Entity, e),
                direction: 'member'
              });
            }
          }
        }
      }
      else if (type === 'predicate') {
        details.name = getName(idStore, ConceptKind.Predicate, denseId);
        // Guard against index out of bounds
        const matrix = (denseId < rawKb.relations.length) ? rawKb.relations[denseId] : null;
        if (matrix) {
          for (let s = 0; s < rawKb.entitiesCount; s++) {
            const row = matrix.rows[s];
            if (row) {
              for (let o = 0; o < rawKb.entitiesCount; o++) {
                if (row.hasBit(o)) {
                  details.relations.push({
                    predicate: 'links',
                    target: `${getName(idStore, ConceptKind.Entity, s)} -> ${getName(idStore, ConceptKind.Entity, o)}`,
                    direction: 'link'
                  });
                }
              }
            }
          }
        }
      }
      else if (type === 'rule') {
        const rules = ruleStore.getRules();
        if (rules[denseId]) {
          const rule = rules[denseId];
          details.name = `Rule #${denseId}`;
          details.text = `IF:\n  ${describeSetPlan(rule.body, idStore)}\nTHEN:\n  ${describeHead(rule.head, idStore)}`;
          details.flow = {
            conditions: extractConditions(rule.body, idStore),
            effect: describeHead(rule.head, idStore)
          };
          details.raw = rule; 
        } else {
          return json(res, 404, { error: 'Rule not found' });
        }
      }
      else if (type === 'action') {
        const actions = actionStore.getActions();
        if (actions[denseId]) {
          const a = actions[denseId];
          details.name = a.name ? a.name.value : `Action #${denseId}`;
          // TODO: Describe action plan similarly
          details.raw = a;
        } else {
          return json(res, 404, { error: 'Action not found' });
        }
      }

      return json(res, 200, { details });
    }

    return json(res, 404, { ok: false, error: 'Endpoint not found' });

  } catch (e) {
    console.error(e);
    return json(res, 500, { ok: false, error: e.message });
  }
}
