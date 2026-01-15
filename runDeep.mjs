#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEEP_SUITES } from "./evals/deep/suites.mjs";
import { runDeepSuite, writeDeepReport } from "./evals/deep/_lib/deep-runner.mjs";
import { renderDeepMarkdownReport } from "./evals/deep/_lib/markdown-report.mjs";
import { timestampId } from "./evals/deep/_lib/time.mjs";

function parseArgs(argv) {
  const options = {
    help: false,
    suites: [],
    maxCases: null,
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
  }
  return options;
}

function helpText() {
  const suiteList = DEEP_SUITES.map((s) => `- ${s.id}`).join("\n");
  return `Deep eval runner

Usage:
  node runDeep.mjs [options]

Options:
  --suite <id>        Run only a specific suite (repeatable)
  --maxCases <n>      Limit number of translated tests per suite
  --help, -h          Show this help text

Available suites:
${suiteList}
`;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(helpText());
    process.exit(0);
  }

  const selected = options.suites.length
    ? DEEP_SUITES.filter((s) => options.suites.includes(s.id))
    : DEEP_SUITES;

  if (selected.length === 0) {
    console.error("No suites matched. Run with --help.");
    process.exit(1);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const timestamp = timestampId();

  const results = [];
  for (const suite of selected) {
    const suiteDir = path.join(__dirname, "evals", "deep", suite.id);
    console.log(`\n▶ Running deep suite: ${suite.id}`);
    const result = await runDeepSuite(suite, { suiteDir, maxCases: options.maxCases });
    console.log(`  Passed: ${result.passed} | Failed: ${result.failed} | Skipped: ${result.skipped}`);
    results.push(result);
  }

  const report = renderDeepMarkdownReport({ timestamp, results });
  const outPath = path.join(__dirname, "evals", "results", `${timestamp}_deepcheck.md`);
  writeDeepReport(outPath, report);
  console.log(`\nDeep report written to ${path.relative(__dirname, outPath)}`);

  const failed = results.some((r) => r.failed > 0);
  process.exit(failed ? 1 : 0);
}

main();
