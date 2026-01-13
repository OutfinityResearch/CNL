const SESSION_HEADER = "X-CNL-Session";

class SessionManager {
  constructor() {
    this.id = null;
  }

  async startNew() {
    const data = await this.create();
    this.id = data && data.ok && data.sessionId ? data.sessionId : null;
    return this.id;
  }

  async create() {
    const res = await fetch("/api/session", { method: "POST" });
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
