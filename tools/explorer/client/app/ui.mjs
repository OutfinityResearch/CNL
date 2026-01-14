export const UI = {
  chat: document.getElementById("chatOutput"),
  input: document.getElementById("textInput"),
  tree: document.getElementById("kbTree"),
  stats: document.getElementById("kbStats"),
  sessionLabel: document.getElementById("sessionLabel"),
  baseLabel: document.getElementById("baseLabel"),

  log(text, type = "system") {
    const msg = document.createElement("div");
    msg.className = `message message--${type}`;
    msg.textContent = text;
    this.chat.appendChild(msg);
    this.chat.scrollTop = this.chat.scrollHeight;
  },

  updateStatsFromResponse(summary, message) {
    if (!summary) return;
    if (message) {
      this.stats.textContent = message;
    } else if (summary.things !== undefined) {
      const parts = [];
      if (summary.things > 0) parts.push(`${summary.things} things`);
      if (summary.categories > 0) parts.push(`${summary.categories} categories`);
      if (summary.relationships > 0) parts.push(`${summary.relationships} relationships`);
      this.stats.textContent = parts.length > 0 ? parts.join(" · ") : "Empty";
    } else {
      this.stats.textContent = `Entities: ${summary.entities || 0}`;
    }
  },

  setSession(sessionId) {
    if (!sessionId) return;
    const shortId = sessionId.split("-")[0];
    this.sessionLabel.textContent = `Session: ${shortId}`;
  },

  setBase(mode) {
    if (!this.baseLabel) return;
    const m = String(mode || "default");
    this.baseLabel.textContent = `Base: ${m}`;
  },
};
