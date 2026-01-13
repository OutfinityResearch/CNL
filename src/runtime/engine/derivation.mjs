import { formatFactId } from "./facts.mjs";
import { renderRuleSummary } from "./rule-render.mjs";

function compareFactId(a, b) {
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  return String(a).localeCompare(String(b));
}

function collectBaseFactIds(factId, store, seen, out) {
  if (seen.has(factId)) return;
  seen.add(factId);
  const justification = store.getJustification(factId);
  if (!justification) return;
  if (justification.kind === "Base") {
    out.push(factId);
    return;
  }
  for (const premiseId of justification.premiseIds ?? []) {
    collectBaseFactIds(premiseId, store, seen, out);
  }
}

export function renderDerivation(rootFactId, state, store, options = {}) {
  const steps = [];
  const seen = new Set();
  const maxDepth = options.maxDepth ?? 10;
  const maxSteps = options.maxSteps ?? 80;

  function walk(factId, depth, indent) {
    if (steps.length >= maxSteps) return;
    if (seen.has(factId)) return;
    seen.add(factId);

    const sentence = formatFactId(factId, state, store) ?? `fact(${String(factId)})`;
    const justification = store.getJustification(factId);
    if (!justification) {
      steps.push(`${indent}${sentence} (no justification available).`);
      return;
    }
    if (justification.kind === "Base") {
      steps.push(`${indent}${sentence} (stated).`);
      return;
    }
    const ruleId = Number.isInteger(justification.ruleId) ? justification.ruleId : null;
    steps.push(`${indent}${sentence}`);
    if (ruleId !== null) {
      const summary = renderRuleSummary(ruleId, state);
      steps.push(`${indent}  applied rule #${ruleId}${summary ? `: ${summary}` : ""}`);
    } else {
      steps.push(`${indent}  applied a rule (unknown rule id)`);
    }
    if (depth >= maxDepth) return;
    const premiseIds = [...(justification.premiseIds ?? [])].sort(compareFactId);
    for (const premiseId of premiseIds) {
      walk(premiseId, depth + 1, indent + "  ");
    }
  }

  walk(rootFactId, 0, "");

  const baseFactIds = [];
  collectBaseFactIds(rootFactId, store, new Set(), baseFactIds);
  baseFactIds.sort(compareFactId);
  const premises = baseFactIds.map((id) => formatFactId(id, state, store)).filter(Boolean);

  return { steps, premises };
}
