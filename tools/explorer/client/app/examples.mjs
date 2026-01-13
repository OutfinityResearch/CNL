import { API } from "./api.mjs";
import { UI } from "./ui.mjs";
import { executeCommand } from "./command.mjs";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatProof(proof) {
  if (!proof || proof.kind !== "ProofTrace") return "";
  const lines = [];
  lines.push(`Proof (${proof.mode})`);
  if (Array.isArray(proof.steps) && proof.steps.length) {
    lines.push(...proof.steps);
  }
  if (Array.isArray(proof.premises) && proof.premises.length) {
    lines.push("");
    lines.push("Premises:");
    proof.premises.slice(0, 30).forEach((p) => lines.push(`- ${p}`));
    if (proof.premises.length > 30) {
      lines.push(`(and ${proof.premises.length - 30} more)`);
    }
  }
  if (proof.counterexample?.entity) {
    lines.push("");
    lines.push(`Counterexample: ${proof.counterexample.entity}`);
  }
  return lines.join("\n");
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
          const res = await API.sendCommand(step.command);
          if (res.ok && res.result?.proof) {
            proofEl.textContent = formatProof(res.result.proof) || "(empty proof)";
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
