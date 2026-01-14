import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CNLSession } from "../../../../src/session/cnl-session.mjs";
import { json } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

export const SESSION_HEADER = "x-cnl-session";
const sessions = new Map();

export async function initSession() {
  sessions.clear();
  console.log("CNL Session store ready.");
}

export function deleteSession(id) {
  if (!id) return false;
  return sessions.delete(id);
}

export function createSession(options = {}) {
  const id = randomUUID();
  const baseEntrypoint = options.baseEntrypoint ?? null;
  const session = new CNLSession({ rootDir: PROJECT_ROOT, baseEntrypoint });
  sessions.set(id, session);
  return { id, session };
}

export function getSessionId(req) {
  const header = req.headers[SESSION_HEADER];
  if (!header) return null;
  return Array.isArray(header) ? header[0] : header;
}

export function requireSession(req, res) {
  const id = getSessionId(req);
  const session = id ? sessions.get(id) : null;
  if (!session) {
    json(res, 400, { ok: false, error: "Missing or invalid session. Create one with POST /api/session." });
    return null;
  }
  return { sessionId: id, session };
}
