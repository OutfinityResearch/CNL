export function formatProofTrace(proof, options = {}) {
  if (!proof || proof.kind !== "ProofTrace") return "";
  const maxPremises = Number.isInteger(options.maxPremises) ? options.maxPremises : 20;
  const maxSteps = Number.isInteger(options.maxSteps) ? options.maxSteps : 200;

  const lines = [];
  lines.push(`Proof (${proof.mode})`);

  if (proof.counterexample?.entity) {
    lines.push("");
    lines.push(`Counterexample: ${proof.counterexample.entity}`);
  }

  if (Array.isArray(proof.premises) && proof.premises.length) {
    lines.push("");
    proof.premises.slice(0, maxPremises).forEach((p) => lines.push(`Fact: ${p}`));
    if (proof.premises.length > maxPremises) {
      lines.push(`(and ${proof.premises.length - maxPremises} more fact(s))`);
    }
  }

  if (Array.isArray(proof.steps) && proof.steps.length) {
    lines.push("");
    proof.steps.slice(0, maxSteps).forEach((s) => lines.push(String(s)));
    if (proof.steps.length > maxSteps) {
      lines.push(`(and ${proof.steps.length - maxSteps} more step(s))`);
    }
  }

  return lines.join("\n");
}

