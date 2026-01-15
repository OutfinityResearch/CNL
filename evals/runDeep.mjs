#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEEP_SUITES } from "./deep/suites.mjs";
import { runDeepSuite, writeDeepReport } from "./deep/_lib/deep-runner.mjs";
import { renderDeepMarkdownReport } from "./deep/_lib/markdown-report.mjs";
import { timestampId } from "./deep/_lib/time.mjs";

function parseArgs(argv) {
  const options = {
    help: false,
    suites: [],
    maxCases: null,
    maxFailures: 10,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--help" || raw === "-h") {
      options.help = true;
      continue;
    }
    if (raw === "--suite") {
      const name = argv[i + 1];
      if (name) {
        options.suites.push(name);
        i += 1;
      }
      continue;
    }
    if (raw.startsWith("--suite=")) {
      options.suites.push(raw.slice("--suite=".length));
      continue;
    }
    if (raw === "--maxCases") {
      const val = argv[i + 1];
      if (val) {
        options.maxCases = Number(val);
        i += 1;
      }
      continue;
    }
    if (raw.startsWith("--maxCases=")) {
      options.maxCases = Number(raw.slice("--maxCases=".length));
      continue;
    }
    if (raw === "--maxFailures") {
      const val = argv[i + 1];
      if (val) {
        options.maxFailures = Number(val);
        i += 1;
      }
      continue;
    }
    if (raw.startsWith("--maxFailures=")) {
      options.maxFailures = Number(raw.slice("--maxFailures=".length));
      continue;
    }
  }

  if (!Number.isFinite(options.maxFailures) || options.maxFailures < 0) options.maxFailures = 10;
  if (options.maxCases !== null && (!Number.isFinite(options.maxCases) || options.maxCases <= 0)) options.maxCases = null;

  return options;
}

function helpText() {
  const suiteList = DEEP_SUITES.map((s) => `- ${s.id}`).join("\n");
  return `Deep eval runner

Usage:
  node evals/runDeep.mjs [options]

Options:
  --suite <id>        Run only a specific suite (repeatable)
  --maxCases <n>      Limit number of translated tests per suite (debugging)
  --maxFailures <n>   Print at most N failures per suite (default: 10)
  --help, -h          Show this help text

Available suites:
${suiteList}
`;
}

function pct(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((100 * part) / whole)}%`;
}

function printFailures(result, { maxFailures }) {
  if (!result.failed) return;
  const list = result.failures ?? [];
  const limit = Math.min(list.length, maxFailures);
  console.log("  Failures:");
  for (let i = 0; i < limit; i += 1) {
    const f = list[i];
    const phase = f.phase ? ` (${f.phase})` : "";
    const err = f.error ? String(f.error).trim() : "unknown error";
    console.log(`    - ${f.caseId}${phase}: ${err}`);
  }
  if (list.length > limit) {
    console.log(`    - ... (${list.length - limit} more; see the markdown report for full details)`);
  }
}

export async function main(argv = process.argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(helpText());
    return 0;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename); // <repo>/evals
  const repoRoot = path.join(__dirname, "..");
  process.chdir(repoRoot);

  const selected = options.suites.length
    ? DEEP_SUITES.filter((s) => options.suites.includes(s.id))
    : DEEP_SUITES;

  if (selected.length === 0) {
    console.error("No suites matched. Run with --help.");
    return 1;
  }

  console.log(`Starting deep evaluation (${selected.length} suite${selected.length === 1 ? "" : "s"})...`);
  const timestamp = timestampId();
  const results = [];

  for (const suite of selected) {
    const suiteDir = path.join(repoRoot, "evals", "deep", suite.id);
    console.log(`\n▶ ${suite.id} — ${suite.title}`);

    const result = await runDeepSuite(suite, { suiteDir, maxCases: options.maxCases });
    results.push(result);

    const total = result.total;
    const effective = result.passed + result.failed;
    console.log(
      `  Total: ${total} | Passed: ${result.passed} | Failed: ${result.failed} | Skipped: ${result.skipped} | Pass(excl skipped): ${pct(result.passed, effective)}`,
    );
    printFailures(result, { maxFailures: options.maxFailures });
  }

  const report = renderDeepMarkdownReport({ timestamp, results });
  const outPath = path.join(repoRoot, "evals", "results", `${timestamp}_deepcheck.md`);
  writeDeepReport(outPath, report);
  console.log(`\nDeep results report: ${path.relative(repoRoot, outPath)}`);

  const failed = results.some((r) => r.failed > 0);
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code));
}

