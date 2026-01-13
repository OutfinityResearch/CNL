import { API } from "./api.mjs";
import { UI } from "./ui.mjs";

export async function updateStats() {
  const data = await API.getStats();
  if (data.ok) {
    UI.setSession(data.sessionId);
    UI.updateStatsFromResponse(data.summary || data.stats, data.message);
  }
}
