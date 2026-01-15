import { json, getStats, getSummary } from "../helpers.mjs";
import { readBody } from "../helpers.mjs";
import { createSession, deleteSession, getSessionId } from "../session-store.mjs";
import * as NLG from "../../nlg.mjs";

function normalizeBaseMode(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "formal" || v === "base.formal" || v === "base.formal.cnl") return "formal";
  if (v === "literature" || v === "literature.cnl") return "literature";
  if (v === "legal" || v === "legal.cnl") return "legal";
  return "default";
}

function baseEntrypointForMode(mode) {
  switch (mode) {
    case "formal": return "theories/base.formal.cnl";
    case "literature": return "theories/literature.cnl";
    case "legal": return "theories/legal.cnl";
    default: return "theories/base.cnl";
  }
}

export async function handleSessionCreate(req, res, url) {
  if (req.method !== "POST" || url.pathname !== "/api/session") return false;
  let body = {};
  try {
    body = await readBody(req);
  } catch {
    body = {};
  }

  const mode = normalizeBaseMode(body.base);
  const baseEntrypoint = baseEntrypointForMode(mode);

  const previous = getSessionId(req);
  if (previous && body.replace === true) {
    deleteSession(previous);
  }

  const { id, session } = createSession({ baseEntrypoint });
  const summary = getSummary(session);
  json(res, 200, {
    ok: true,
    sessionId: id,
    base: mode,
    baseEntrypoint,
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
