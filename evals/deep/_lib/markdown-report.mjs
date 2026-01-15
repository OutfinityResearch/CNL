function codeBlock(lang, content) {
  const text = String(content ?? "").trimEnd();
  return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function percent(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export function renderDeepMarkdownReport({ timestamp, results, options = {} }) {
  const lines = [];
  lines.push(`# Deep Evaluation Report (${timestamp})`);
  lines.push("");
  lines.push(`- Suites: ${results.length}`);
  lines.push(`- Dataset cache: evals/deep/cache/`);
  lines.push("");

  const totals = results.reduce(
    (acc, r) => {
      acc.passed += r.passed;
      acc.failed += r.failed;
      acc.skipped += r.skipped;
      return acc;
    },
    { passed: 0, failed: 0, skipped: 0 },
  );
  const executed = totals.passed + totals.failed;
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Passed: ${totals.passed}`);
  lines.push(`- Failed: ${totals.failed}`);
  lines.push(`- Skipped: ${totals.skipped}`);
  lines.push(`- Pass rate (excluding skipped): ${percent(totals.passed, executed)}`);
  lines.push("");

  lines.push(`## Suites`);
  lines.push("");
  for (const r of results) {
    const executedSuite = r.passed + r.failed;
    lines.push(`### ${r.id} — ${r.title}`);
    lines.push("");
    lines.push(`- Total: ${r.total}`);
    lines.push(`- Passed: ${r.passed}`);
    lines.push(`- Failed: ${r.failed}`);
    lines.push(`- Skipped: ${r.skipped}`);
    lines.push(`- Pass rate (excluding skipped): ${percent(r.passed, executedSuite)}`);
    lines.push("");

    if (r.failures.length === 0) continue;
    lines.push(`#### Failures`);
    lines.push("");

    for (const f of r.failures) {
      lines.push(`- Case: \`${f.caseId}\` (${f.phase})`);
      lines.push(`  - Error: ${f.error}`);
      lines.push("");
      lines.push(codeBlock("json", safeJson(f.original)));
      lines.push(codeBlock("cnl", `${f.cnl.theory}\n\n${f.cnl.command}\n`));
      if (f.expected) {
        lines.push(codeBlock("json", safeJson(f.expected)));
      }
      if (f.actual !== undefined) {
        lines.push(`Actual: ${f.actual}`);
        lines.push("");
      }
    }
  }

  if (options.note) {
    lines.push("## Notes");
    lines.push("");
    lines.push(options.note);
    lines.push("");
  }

  return lines.join("\n");
}
