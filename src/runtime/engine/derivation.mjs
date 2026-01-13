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
  const seenFacts = new Set();
  const maxDepth = options.maxDepth ?? 10;
  const maxSteps = options.maxSteps ?? 80;
  const includeTherefore = options.includeTherefore ?? true;

  function walk(factId, depth) {
    if (steps.length >= maxSteps) return;
    if (seenFacts.has(factId)) return;
    seenFacts.add(factId);

    const sentence = formatFactId(factId, state, store) ?? `fact(${String(factId)})`;
    const justification = store.getJustification(factId);
    if (!justification) {
      steps.push(`Missing justification: ${sentence}`);
      return;
    }
    if (justification.kind === "Base") {
      // Base facts are surfaced via `premises` instead of repeating them in the derivation steps.
      return;
    }

    if (depth >= maxDepth) {
      steps.push(`Derived fact: ${sentence}`);
      return;
    }

    const premiseIds = [...(justification.premiseIds ?? [])].sort(compareFactId);
    for (const premiseId of premiseIds) {
      const premiseJust = store.getJustification(premiseId);
      if (premiseJust && premiseJust.kind !== "Base") {
        walk(premiseId, depth + 1);
      }
    }

    const ruleId = Number.isInteger(justification.ruleId) ? justification.ruleId : null;
    if (ruleId !== null) {
      const summary = renderRuleSummary(ruleId, state);
      if (summary) {
        steps.push(`Applied rule: ${summary}`);
      } else {
        steps.push(`Applied rule: rule #${ruleId}`);
      }
    } else {
      steps.push("Applied rule.");
    }
    if (includeTherefore) {
      steps.push(`Therefore: ${sentence}`);
    }
  }

  walk(rootFactId, 0);

  const baseFactIds = [];
  collectBaseFactIds(rootFactId, store, new Set(), baseFactIds);
  baseFactIds.sort(compareFactId);
  const premises = baseFactIds.map((id) => formatFactId(id, state, store)).filter(Boolean);

  return { steps, premises };
}
