import { Session } from "./app/session.mjs";
import { UI } from "./app/ui.mjs";
import { renderExamples } from "./app/examples.mjs";
import { refreshTree } from "./app/tree.mjs";
import { refreshGraph } from "./app/graph.mjs";
import { executeCommand } from "./app/command.mjs";
import { bindTabs } from "./app/tabs.mjs";
import { updateStats } from "./app/stats.mjs";

const BASE_PREF_KEY = "cnl.explorer.base";
const BENIGN_PREF_KEY = "cnl.explorer.includeBenignDuplicates";

function normalizeBasePref(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "formal") return "formal";
  if (v === "literature") return "literature";
  if (v === "legal") return "legal";
  return "default";
}

function getBasePref() {
  try {
    return normalizeBasePref(localStorage.getItem(BASE_PREF_KEY));
  } catch {
    return "default";
  }
}

function setBasePref(mode) {
  const normalized = normalizeBasePref(mode);
  try {
    localStorage.setItem(BASE_PREF_KEY, normalized);
  } catch {
    // ignore
  }
  return normalized;
}

function getBenignPref() {
  try {
    return localStorage.getItem(BENIGN_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function setBenignPref(enabled) {
  try {
    localStorage.setItem(BENIGN_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  return Boolean(enabled);
}

async function restartSession(base, reason) {
  const mode = normalizeBasePref(base);
  Session.setBase(mode);
  await Session.startNew({ base: mode });
  UI.setBase(mode);
  if (reason) UI.log(reason, "system");
  await updateStats();
  await refreshTree();
  await refreshGraph();
}

function bindGlobalEvents() {
  document.getElementById("sendBtn").onclick = async () => {
    const text = UI.input.value.trim();
    if (!text) return;
    UI.log(text, "user");
    UI.input.value = "";
    await executeCommand(text);
  };

  document.getElementById("graphRefresh").onclick = async () => {
    await refreshGraph();
  };

  const baseSelect = document.getElementById("baseSelect");
  if (baseSelect) {
    baseSelect.onchange = async () => {
      const next = normalizeBasePref(baseSelect.value);
      const prev = getBasePref();
      if (next === prev) return;
      if (!confirm(`Switch base to "${next}"? This will reset the session.`)) {
        baseSelect.value = prev;
        return;
      }
      setBasePref(next);
      await restartSession(next, `Session restarted with base: ${next}.`);
    };
  }

  const benignToggle = document.getElementById("includeBenignToggle");
  if (benignToggle) {
    benignToggle.checked = getBenignPref();
    benignToggle.onchange = async () => {
      setBenignPref(Boolean(benignToggle.checked));
      await refreshTree();
    };
  }

  document.getElementById("resetBtn").onclick = async () => {
    if (confirm("Reset session?")) {
      const base = getBasePref();
      await restartSession(base, "Session restarted.");
    }
  };

  bindTabs(refreshGraph);
}

(async () => {
  await renderExamples();
  const base = getBasePref();
  const baseSelect = document.getElementById("baseSelect");
  if (baseSelect) baseSelect.value = base;
  const benignToggle = document.getElementById("includeBenignToggle");
  if (benignToggle) benignToggle.checked = getBenignPref();

  Session.setBase(base);
  await Session.startNew({ base });
  UI.setBase(base);
  await updateStats();
  await refreshTree();
  await refreshGraph();
  UI.log(`CNL Session ready (base: ${base}).`, "system");
  bindGlobalEvents();
})();
