import { CNLSession } from '../../../src/session/cnl-session.mjs';
import { ConceptKind } from '../../../src/ids/interners.mjs';

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

export async function handleApi(req, res, url) {
  try {
    // GET /api/session - Stats
    if (req.method === 'GET' && url.pathname === '/api/session') {
      const kb = session.state.kb;
      return json(res, 200, {
        ok: true,
        stats: {
          entities: kb.entitiesCount,
          predicates: kb.predicatesCount,
          unaries: kb.unaryCount,
          attributes: kb.attributesCount
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
      
      return json(res, 200, {
        ok: result.errors.length === 0,
        errors: result.errors,
        applied: result.applied
      });
    }

    // GET /api/tree - Hierarchical view for the explorer
    if (req.method === 'GET' && url.pathname === '/api/tree') {
      const tree = [];
      const idStore = session.state.idStore;
      
      // Entities Branch
      const entitiesNode = { id: 'entities', text: 'Entities', children: [], icon: 'folder' };
      const entityCount = idStore.size(ConceptKind.Entity);
      
      for (let i = 0; i < entityCount; i++) {
        const cid = idStore.getConceptualId(ConceptKind.Entity, i);
        if (cid !== undefined) {
          const key = idStore.lookupKey(cid);
          entitiesNode.children.push({ id: `e-${i}`, text: key, icon: 'user' });
        }
      }
      tree.push(entitiesNode);

      // Unaries Branch (Types/Properties)
      const unaryNode = { id: 'unaries', text: 'Properties', children: [], icon: 'folder' };
      const unaryCount = idStore.size(ConceptKind.UnaryPredicate);
      
      for (let i = 0; i < unaryCount; i++) {
        const cid = idStore.getConceptualId(ConceptKind.UnaryPredicate, i);
        if (cid !== undefined) {
          const key = idStore.lookupKey(cid);
          // Optional: count members
          const bitset = session.state.kb.kb.unaryIndex[i];
          const count = bitset ? bitset.popcount() : 0;
          unaryNode.children.push({ id: `u-${i}`, text: `${key} (${count})`, count, icon: 'tag' });
        }
      }
      tree.push(unaryNode);

      return json(res, 200, { tree });
    }

    return json(res, 404, { ok: false, error: 'Endpoint not found' });

  } catch (e) {
    console.error(e);
    return json(res, 500, { ok: false, error: e.message });
  }
}
