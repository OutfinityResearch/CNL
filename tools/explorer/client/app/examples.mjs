import { API } from "./api.mjs";
import { UI } from "./ui.mjs";
import { executeCommand } from "./command.mjs";
import { Session } from "./session.mjs";
import { formatProofTrace } from "./proof.mjs";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_PREF_KEY = "cnl.explorer.base";

function normalizeBasePref(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "formal" ? "formal" : "default";
}

function getBasePref() {
  try {
    return normalizeBasePref(localStorage.getItem(BASE_PREF_KEY));
  } catch {
    return "default";
  }
}

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function summarizeResult(result) {
  if (!result) return "";
  switch (result.kind) {
    case "QueryResult":
    case "SolveResult":
      return JSON.stringify((result.entities ?? []).map((entry) => displayEntityKey(entry.key)));
    case "ProofResult":
      return String(result.value);
    case "ExplainResult":
      if (Array.isArray(result.baseFacts) && result.baseFacts.length > 0) {
        return result.baseFacts.join(" | ");
      }
      return result.justification?.kind ?? "explain";
    case "PlanResult":
      return result.status ?? "";
    case "SimulationResult":
      return `steps=${result.steps}`;
    case "OptimizeResult":
      return `${result.status}:${result.value}`;
    default:
      return "";
  }
}

function renderReport(reportEl, lines) {
  UI.log(lines.join("\n"), "system");
}

export async function renderExamples() {
  const container = document.getElementById("examplesList");
  container.innerHTML = "Loading examples...";

  const data = await API.getExamples();
  if (!data.suite) {
    container.innerHTML = "Error loading examples.";
    return;
  }

  container.innerHTML = "";

  const loadedExamples = new Set();

  async function ensureContextLoaded(ex) {
    if (!ex || !ex.id) return false;
    if (loadedExamples.has(ex.id)) return true;
    const res = await API.sendCommand(ex.theory);
    if (res && res.ok) {
      loadedExamples.add(ex.id);
      return true;
    }
    return false;
  }

  const loadAllBtn = document.getElementById("loadAllBtn");
  if (loadAllBtn) {
    loadAllBtn.onclick = async () => {
      UI.log("[Loading All Contexts]", "system");
      for (const ex of data.suite) {
        UI.log(`[${ex.title}]`, "system");
        await executeCommand(ex.theory);
      }
    };
  }

  const testAllBtn = document.getElementById("testAllBtn");
  if (testAllBtn) {
    testAllBtn.onclick = async () => {
      if (!confirm("Run TestAll? This will restart the session and run all example steps.")) return;

      testAllBtn.disabled = true;
      try {
        const base = getBasePref();
        loadedExamples.clear();

        UI.log(`[TestAll] Restarting session (base: ${base})...`, "system");
        Session.setBase(base);
        await Session.startNew({ base });

        const report = [];
        let passed = 0;
        let failed = 0;
        let skipped = 0;

        for (const ex of data.suite) {
          // Keep examples independent, but keep the same session id.
          await API.reset();
          loadedExamples.delete(ex.id);

          UI.log(`[Test: ${ex.title}]`, "system");
          UI.log(ex.theory.trim(), "user");
          const learnRes = await executeCommand(ex.theory);
          if (!learnRes?.ok) {
            failed += ex.steps.length;
            report.push(`FAIL [${ex.id}] learn context`);
            for (const step of ex.steps) {
              report.push(`  FAIL ${step.command}`);
            }
            continue;
          }

          for (const step of ex.steps) {
            UI.log(step.command, "user");
            const res = await executeCommand(step.command);
            if (!res?.ok) {
              failed += 1;
              report.push(`FAIL [${ex.id}] ${step.command}`);
              continue;
            }

            const output = summarizeResult(res.result);
            if (Array.isArray(step.expectedMatches) && step.expectedMatches.length > 0) {
              const ok = step.expectedMatches.some((token) => output.includes(token));
              if (!ok) {
                failed += 1;
                report.push(`FAIL [${ex.id}] ${step.command}`);
                report.push(`  expected match: ${step.expectedMatches.join(" | ")}`);
                report.push(`  found: ${output}`);
              } else {
                passed += 1;
                report.push(`PASS [${ex.id}] ${step.command}`);
              }
              continue;
            }

            if (step.expected !== undefined && step.expected !== null) {
              if (String(step.expected) !== output) {
                failed += 1;
                report.push(`FAIL [${ex.id}] ${step.command}`);
                report.push(`  expected: ${step.expected}`);
                report.push(`  found: ${output}`);
                continue;
              }
            }

            if (!step.expected) {
              skipped += 1;
              report.push(`SKIP [${ex.id}] ${step.command}`);
              continue;
            }

            passed += 1;
            report.push(`PASS [${ex.id}] ${step.command}`);
          }
        }

        report.unshift(`TestAll results: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
        renderReport(null, report);
        UI.log(`[TestAll] Done: ${passed} passed, ${failed} failed, ${skipped} skipped.`, "system");
      } finally {
        testAllBtn.disabled = false;
      }
    };
  }

  data.suite.forEach((ex) => {
    const card = document.createElement("div");
    card.className = "example-card";

    let html = `<h3>${ex.title}</h3>`;

    html += `<div class="example-grid">`;

    html += `<div class="col-theory">
      <div class="panel-header">Context (Theory)</div>
      <div class="theory-content">
        <pre>${ex.theory}</pre>
        <button class="btn btn--sm btn--secondary load-theory-btn">Load Context</button>
      </div>
    </div>`;

    html += `<div class="col-steps">
      <div class="panel-header">Steps</div>
      <table class="steps-table">
        <thead>
          <tr>
            <th>Command</th>
            <th>Expected</th>
            <th>Proof</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>`;

    ex.steps.forEach((step, stepIndex) => {
      html += `<tr>
        <td class="step-cmd mono">${step.command}</td>
        <td class="step-exp mono">${step.expected || "-"}</td>
        <td>
          <button class="btn btn--sm btn--secondary view-proof-btn" data-step="${ex.id}:${stepIndex}">View</button>
          <pre class="mono" data-proof="${ex.id}:${stepIndex}" style="display:none; margin-top:8px; white-space:pre-wrap;"></pre>
        </td>
        <td><button class="btn btn--sm btn--primary run-step-btn" data-cmd="${escapeHtml(step.command)}">Run</button></td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    html += `</div>`;

    card.innerHTML = html;
    container.appendChild(card);

    const loadBtn = card.querySelector(".load-theory-btn");
    loadBtn.onclick = async () => {
      UI.log(`[Loading Context: ${ex.title}]`, "system");
      UI.log(ex.theory.trim(), "user");
      await executeCommand(ex.theory);
    };

    card.querySelectorAll(".run-step-btn").forEach((btn) => {
      btn.onclick = async () => {
        const cmd = btn.getAttribute("data-cmd");
        await ensureContextLoaded(ex);
        UI.log(cmd, "user");
        await executeCommand(cmd);
      };
    });

    card.querySelectorAll(".view-proof-btn").forEach((btn) => {
      btn.onclick = async () => {
        const stepKey = btn.getAttribute("data-step");
        const proofEl = card.querySelector(`pre[data-proof="${CSS.escape(stepKey)}"]`);
        if (!proofEl) return;
        const stepId = String(stepKey).split(":")[1];
        const idx = Number(stepId);
        const step = Number.isInteger(idx) ? ex.steps[idx] : null;
        if (!step) return;

        btn.disabled = true;
        btn.textContent = "Loading...";
        try {
          await ensureContextLoaded(ex);
          const res = await API.sendCommand(step.command);
          if (res.ok && res.result?.proof) {
            proofEl.textContent = formatProofTrace(res.result.proof) || "(empty proof)";
          } else if (res.ok) {
            proofEl.textContent = "(no proof returned for this step)";
          } else {
            proofEl.textContent = res.message || "(command failed)";
          }
          proofEl.style.display = "block";
        } catch (error) {
          proofEl.textContent = `Network Error: ${error.message}`;
          proofEl.style.display = "block";
        } finally {
          btn.disabled = false;
          btn.textContent = "View";
        }
      };
    });
  });
}
