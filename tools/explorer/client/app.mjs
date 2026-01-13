import { Session } from "./app/session.mjs";
import { UI } from "./app/ui.mjs";
import { renderExamples } from "./app/examples.mjs";
import { refreshTree } from "./app/tree.mjs";
import { refreshGraph } from "./app/graph.mjs";
import { executeCommand } from "./app/command.mjs";
import { bindTabs } from "./app/tabs.mjs";
import { updateStats } from "./app/stats.mjs";

function bindGlobalEvents() {
  document.getElementById("sendBtn").onclick = async () => {
    const text = UI.input.value.trim();
    if (!text) return;
    UI.log(text, "user");
    UI.input.value = "";
    await executeCommand(text);
  };

  document.getElementById("resetBtn").onclick = async () => {
    if (confirm("Reset session?")) {
      await API.reset();
      UI.log("Session reset.", "system");
      await updateStats();
      await refreshTree();
    }
  };

  bindTabs(refreshGraph);
}

import { API } from "./app/api.mjs";

(async () => {
  await renderExamples();
  await Session.startNew();
  await updateStats();
  await refreshTree();
  UI.log("CNL Session ready.", "system");
  bindGlobalEvents();
})();
