import { Session } from "./session.mjs";

async function apiFetch(path, options = {}) {
  await Session.ensure();
  const headers = { ...(options.headers || {}), ...Session.headers() };
  let res = await fetch(path, { ...options, headers });
  let data = await res.json();
  if (data && data.error && data.error.includes("Missing or invalid session")) {
    Session.clear();
    await Session.startNew();
    const retryHeaders = { ...(options.headers || {}), ...Session.headers() };
    res = await fetch(path, { ...options, headers: retryHeaders });
    data = await res.json();
  }
  return data;
}

export const API = {
  async getStats() {
    return apiFetch("/api/session");
  },
  async sendCommand(text) {
    return apiFetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  },
  async getTree() {
    return apiFetch("/api/tree");
  },
  async getEntity(type, id) {
    const params = new URLSearchParams({ type, id: String(id) });
    return apiFetch(`/api/entity?${params.toString()}`);
  },
  async getGraph() {
    return apiFetch("/api/graph");
  },
  async getExamples() {
    const res = await fetch("/api/examples");
    return res.json();
  },
  async reset() {
    return apiFetch("/api/reset", { method: "POST" });
  },
};
