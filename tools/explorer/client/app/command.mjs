import { UI } from "./ui.mjs";
import { activateTab } from "./tabs.mjs";
import { refreshTree } from "./tree.mjs";
import { API } from "./api.mjs";
import { updateStats } from "./stats.mjs";
import { formatProofTrace } from "./proof.mjs";

function formatEntityKey(key, id) {
  if (!key) return `#${id}`;
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function formatResult(result) {
  if (!result || !result.kind) return JSON.stringify(result, null, 2);

  if (result.kind === "QueryResult" || result.kind === "SolveResult") {
    const items = result.entities.map((entry) => formatEntityKey(entry.key, entry.id));
    return items.length ? items.join("\n") : "(no results)";
  }

  if (result.kind === "ProofResult") {
    return result.value ? "True" : "False";
  }

  if (result.kind === "ExplainResult") {
    return JSON.stringify(result, null, 2);
  }

  if (result.kind === "PlanResult") {
    const steps = result.steps && result.steps.length ? result.steps.join("\n") : "(no steps)";
    return `Plan status: ${result.status}\n${steps}`;
  }

  if (result.kind === "SimulationResult") {
    return JSON.stringify(result, null, 2);
  }

  if (result.kind === "OptimizeResult") {
    return `Optimize status: ${result.status}\nValue: ${result.value}`;
  }

  return JSON.stringify(result, null, 2);
}

export async function executeCommand(text) {
  activateTab("tabChat");

  try {
    const res = await API.sendCommand(text);
    if (res.ok) {
      let message = res.message || res.output || (res.result ? formatResult(res.result) : "✓ Done.");
      const proofText = res.result?.proof ? formatProofTrace(res.result.proof) : "";
      if (proofText) {
        message = `${message}\n\n${proofText}`;
      }
      UI.log(message, "system");
    } else {
      if (res.message) {
        UI.log(res.message, "error");
      } else if (res.errors && res.errors.length) {
        res.errors.forEach((e) => UI.log(`Error: ${e.message || e}`, "error"));
      } else {
        UI.log("Error: Command failed.", "error");
      }
    }
    await updateStats();
    await refreshTree();
    return res;
  } catch (e) {
    UI.log(`Network Error: ${e.message}`, "error");
    return { ok: false, error: e };
  }
}
