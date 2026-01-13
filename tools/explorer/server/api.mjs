import { initSession, requireSession } from "./api/session-store.mjs";
import { json } from "./api/helpers.mjs";
import { handleSessionCreate, handleSessionStats, handleReset } from "./api/routes/session.mjs";
import { handleExamples } from "./api/routes/examples.mjs";
import { handleCommand } from "./api/routes/command.mjs";
import { handleTree } from "./api/routes/tree.mjs";
import { handleEntity } from "./api/routes/entity.mjs";
import { handleGraph } from "./api/routes/graph.mjs";

export { initSession };

export async function handleApi(req, res, url) {
  try {
    if (handleSessionCreate(req, res, url)) return;
    if (handleExamples(req, res, url)) return;

    const sessionData = requireSession(req, res);
    if (!sessionData) return;

    const { sessionId, session } = sessionData;
    const context = {
      sessionId,
      session,
      idStore: session.state.idStore,
      rawKb: session.state.kb.kb,
      ruleStore: session.state.ruleStore,
      actionStore: session.state.actionStore,
    };

    if (handleSessionStats(req, res, url, context)) return;
    if (handleReset(req, res, url, context)) return;
    if (await handleCommand(req, res, url, context)) return;
    if (handleTree(req, res, url, context)) return;
    if (handleEntity(req, res, url, context)) return;
    if (handleGraph(req, res, url, context)) return;

    json(res, 404, { ok: false, error: "Unknown API endpoint." });
  } catch (error) {
    console.error(error);
    json(res, 500, { ok: false, error: "Internal Server Error" });
  }
}
