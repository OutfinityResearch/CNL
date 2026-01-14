const SESSION_HEADER = "X-CNL-Session";

class SessionManager {
  constructor() {
    this.id = null;
    this.base = "default";
  }

  setBase(mode) {
    const v = String(mode || "").trim().toLowerCase();
    this.base = v === "formal" ? "formal" : "default";
    return this.base;
  }

  async startNew(options = {}) {
    const previous = this.id;
    const base = options.base ?? this.base ?? "default";
    const data = await this.create({ ...options, base, replaceSessionId: previous });
    this.id = data && data.ok && data.sessionId ? data.sessionId : null;
    return this.id;
  }

  async create(options = {}) {
    const base = options.base ?? "default";
    const replaceSessionId = options.replaceSessionId ?? null;
    const headers = { "Content-Type": "application/json" };
    if (replaceSessionId) headers[SESSION_HEADER] = replaceSessionId;

    const body = JSON.stringify({
      base,
      replace: Boolean(replaceSessionId),
    });

    const res = await fetch("/api/session", { method: "POST", headers, body });
    return res.json();
  }

  async ensure() {
    if (this.id) return this.id;
    await this.startNew();
    return this.id;
  }

  clear() {
    this.id = null;
  }

  headers() {
    return this.id ? { [SESSION_HEADER]: this.id } : {};
  }
}

export const Session = new SessionManager();
