import { json, getStats, getSummary } from "../helpers.mjs";
import { createSession } from "../session-store.mjs";
import * as NLG from "../../nlg.mjs";

export function handleSessionCreate(req, res, url) {
  if (req.method !== "POST" || url.pathname !== "/api/session") return false;
  const { id, session } = createSession();
  const summary = getSummary(session);
  json(res, 200, {
    ok: true,
    sessionId: id,
    stats: getStats(session),
    summary,
    message: "Session ready. Start adding facts.",
  });
  return true;
}

export function handleSessionStats(req, res, url, context) {
  if (req.method !== "GET" || url.pathname !== "/api/session") return false;
  const summary = getSummary(context.session);
  json(res, 200, {
    ok: true,
    sessionId: context.sessionId,
    stats: getStats(context.session),
    summary,
    message: NLG.formatSummary(summary),
  });
  return true;
}

export function handleReset(req, res, url, context) {
  if (req.method !== "POST" || url.pathname !== "/api/reset") return false;
  context.session.reset();
  json(res, 200, { ok: true, message: "Knowledge cleared. Ready for new facts." });
  return true;
}
