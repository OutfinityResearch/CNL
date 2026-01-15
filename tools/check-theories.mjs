#!/usr/bin/env node
/**
 * checkTheories - Static checker for CNL theory bundles.
 *
 * For each entrypoint:
 * - expands `Load:` directives
 * - collects and validates directive-based renames (`RenameType:` / `RenamePredicate:`)
 * - strips preprocessor directives, parses, compiles, and gathers dictionary issues
 * - computes cross-file duplicate/conflict issues (DS24)
 *
 * By default, it checks 4 main entrypoints:
 * - theories/base.cnl
 * - theories/base.formal.cnl
 * - theories/legal.cnl
 * - theories/literature.cnl
 *
 * Usage:
 *   node tools/check-theories.mjs
 *   node tools/check-theories.mjs -e theories/base.cnl -e theories/legal.cnl
 *   node tools/check-theories.mjs -e theories/base.formal.cnl -v
 *   node tools/check-theories.mjs -f report.txt
 */

import fs from "node:fs";
import path from "node:path";
import { parseProgram } from "../src/parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../src/compiler/compile.mjs";
import {
  analyzeCrossOntologyDuplicates,
  expandTheoryEntrypoint,
  extractLoadTimeRenames,
  stripPreprocessorDirectives,
} from "../src/theories/diagnostics.mjs";
import { applyLoadTimeRenames } from "../src/theories/renames.mjs";

const DEFAULT_ENTRYPOINTS = [
  "theories/base.cnl",
  "theories/base.formal.cnl",
  "theories/legal.cnl",
  "theories/literature.cnl",
];

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function parseArgs(argv) {
  const args = {
    entrypoints: [],
    outputFile: null,
    help: false,
    verbose: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--entrypoint" || raw === "-e") {
      args.entrypoints.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (raw.startsWith("--entrypoint=")) {
      args.entrypoints.push(raw.slice("--entrypoint=".length));
      continue;
    }
    if (raw === "-f" || raw === "--output") {
      args.outputFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--output=")) {
      args.outputFile = raw.slice("--output=".length);
      continue;
    }
    if (raw === "-v" || raw === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (raw === "--help" || raw === "-h") {
      args.help = true;
      continue;
    }
  }
  return args;
}

function usage() {
  return `checkTheories - Static checker for CNL theory bundles.

Usage:
  node tools/check-theories.mjs [options]

Options:
  --entrypoint, -e <file>   Entrypoint file (repeatable). Default: 4 main entrypoints.
  --output, -f <file>       Write report to file instead of stdout
  --verbose, -v             Verbose output (loaded files + sample issues)
  --help, -h                Show this help message

Examples:
  node tools/check-theories.mjs
  node tools/check-theories.mjs -e theories/base.formal.cnl
  node tools/check-theories.mjs -e theories/base.cnl -e theories/legal.cnl
  node tools/check-theories.mjs -f report.txt
`;
}

function stripAnsi(text) {
  return String(text ?? "").replace(ANSI_RE, "");
}

function padRight(text, width) {
  const s = String(text ?? "");
  const visible = stripAnsi(s);
  if (visible.length >= width) return s;
  return s + " ".repeat(width - visible.length);
}

function renderTable(headers, rows) {
  const widths = headers.map((h, idx) => {
    let w = stripAnsi(h).length;
    for (const row of rows) {
      w = Math.max(w, stripAnsi(row[idx] ?? "").length);
    }
    return w;
  });
  const headerLine = headers.map((h, idx) => padRight(h, widths[idx])).join(" | ");
  const sepLine = widths.map((w) => "-".repeat(w)).join("-+-");
  const bodyLines = rows.map((row) => row.map((cell, idx) => padRight(cell ?? "", widths[idx])).join(" | "));
  return [headerLine, sepLine, ...bodyLines].join("\n");
}

function createColor(options = {}) {
  const enabled = options.enabled ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  const color = (code, text) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : String(text));
  return {
    enabled,
    red: (t) => color("91", t), // bright red
    yellow: (t) => color("93", t), // bright yellow
    green: (t) => color("92", t), // bright green
    cyan: (t) => color("36", t),
    dim: (t) => color("2", t),
    bold: (t) => color("1", t),
  };
}

function legendRows() {
  return [
    ["FILE_NOT_FOUND", "error", "Theory bundle cannot be loaded.", "Fix the path or the Load: directive target."],
    ["LOAD_ERROR", "error", "Load expansion failed (escaping rootDir, cycles/repeats, invalid paths).", "Fix Load: paths and remove cycles/repeats."],
    ["PARSE_ERROR", "error", "Theory file cannot be parsed; compilation will be incomplete.", "Fix syntax (DS03) near the reported location."],
    ["COMPILE_ERROR", "error", "Compilation failed for at least one statement.", "Fix dictionary declarations, grounding, or invalid statements."],
    ["LoadTimeRenameConflict", "error", "Non-deterministic renames: same key maps to multiple targets.", "Make RenameType/RenamePredicate directives consistent (DS25)."],
    ["TypeBinaryPredicateConflict", "error", "Key is both a type and a binary predicate; meaning is ambiguous.", "Rename one side (prefer RenamePredicate) or resolve at generation-time (DS22/DS25)."],
    ["AmbiguousPredicateArity", "warning", "Predicate is declared unary and binary; may break validation.", "Fix dictionary declarations to a single arity."],
    ["AmbiguousTypeParent", "warning", "Type has multiple parents; hierarchy is unclear.", "Pick one parent or accept multi-parent modeling explicitly."],
    ["DuplicateTypeDeclaration", "warning", "Same type key declared across multiple loaded files.", "Review overlaps; optionally disambiguate by renaming conflicting sources."],
    ["DuplicatePredicateDeclaration", "warning", "Same binary predicate key declared across multiple loaded files.", "Review overlaps; optionally disambiguate by renaming conflicting sources."],
    ["DuplicateTypeDifferentParents", "warning", "Same type key has different parents across sources.", "Treat as semantic conflict; rename or choose a canonical parent."],
    ["DuplicatePredicateDifferentConstraints", "warning", "Same predicate has different domain/range constraints across sources.", "Treat as semantic conflict; rename or harmonize constraints."],
    ["DuplicateRule", "warning", "Redundant rules add noise and can slow reasoning.", "Deduplicate rule sources or import filters."],
    ["LoadTimeRenameApplied", "warning", "Bundle was rewritten at load-time (transparent but still a rewrite).", "Verify rename directives match your intended vocabulary (DS25)."],
  ];
}

function selectEntrypoints(args, rootDir) {
  const requested = args.entrypoints.length > 0 ? args.entrypoints : DEFAULT_ENTRYPOINTS;
  const existing = [];
  const missing = [];
  for (const rel of requested) {
    const abs = path.resolve(rootDir, rel);
    if (fs.existsSync(abs)) existing.push(rel);
    else missing.push(rel);
  }
  return { requested, existing, missing };
}

class TheoryChecker {
  constructor(options = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.verbose = options.verbose ?? false;
    this.loadedFiles = new Map(); // absPath -> { text, relPath, ast?, parseSuccess? }
    this.loadOrder = [];
    this.errors = [];
    this.warnings = [];
    this.loadTimeRenames = null;
    this.compiledState = null;
  }

  check(entrypoint) {
    const result = {
      entrypoint,
      summary: {
        filesLoaded: 0,
        totalErrors: 0,
        totalWarnings: 0,
      },
      errors: [],
      warnings: [],
      counts: [],
      loadedFiles: [],
    };

    let expanded = null;
    try {
      expanded = expandTheoryEntrypoint(entrypoint, { rootDir: this.rootDir });
    } catch (err) {
      this.errors.push({
        kind: "LOAD_ERROR",
        severity: "error",
        message: `Failed to expand Load directives: ${err.message || String(err)}`,
        file: entrypoint,
      });
      return this.#buildResult(result);
    }

    this.loadedFiles.clear();
    this.loadOrder.length = 0;
    this.errors.length = 0;
    this.warnings.length = 0;

    for (const f of expanded.files) {
      this.loadedFiles.set(f.absPath, { text: f.text, relPath: f.relPath, errors: [], warnings: [] });
      this.loadOrder.push(f.absPath);
    }

    const extracted = extractLoadTimeRenames(expanded.files);
    this.loadTimeRenames = {
      predicateKeyRenames: extracted.predicateKeyRenames,
      typeKeyRenames: extracted.typeKeyRenames,
    };
    for (const issue of extracted.issues) {
      const bucket = issue.severity === "error" ? this.errors : this.warnings;
      bucket.push({
        kind: issue.kind,
        severity: issue.severity === "error" ? "error" : "warning",
        message: issue.message,
        file: issue.file,
        line: issue.line,
      });
    }

    this.parseFiles();
    this.compileAndCheck();
    this.collectDictionaryIssues();
    this.analyzeConceptualIssues();

    return this.#buildResult(result);
  }

  parseFiles() {
    for (const filePath of this.loadOrder) {
      const entry = this.loadedFiles.get(filePath);
      const textWithoutDirectives = stripPreprocessorDirectives(entry.text);
      try {
        const ast = parseProgram(textWithoutDirectives);
        entry.ast = ast;
        entry.parseSuccess = true;
      } catch (err) {
        entry.parseSuccess = false;
        this.errors.push({
          kind: "PARSE_ERROR",
          severity: "error",
          message: `Parse error in ${entry.relPath}: ${err.message || "Unknown error"}`,
          file: entry.relPath,
        });
      }
    }
  }

  compileAndCheck() {
    const state = createCompilerState({
      validateDictionary: true,
      projectEntityAttributes: false,
    });

    for (const filePath of this.loadOrder) {
      const entry = this.loadedFiles.get(filePath);
      if (!entry.ast) continue;

      state.errors.length = 0;
      if (this.loadTimeRenames) {
        applyLoadTimeRenames(entry.ast, this.loadTimeRenames);
      }
      compileProgram(entry.ast, {
        state,
        projectEntityAttributes: false,
      });

      if (state.errors.length > 0) {
        for (const err of state.errors) {
          this.errors.push({
            kind: "COMPILE_ERROR",
            severity: "error",
            message: `Compile error in ${entry.relPath}: ${err.message || String(err)}`,
            file: entry.relPath,
          });
        }
      }
    }

    this.compiledState = state;
  }

  collectDictionaryIssues() {
    const dictionary = this.compiledState?.dictionary;
    if (!dictionary) return;

    const seen = new Set();
    const add = (issue) => {
      if (!issue || typeof issue !== "object") return;
      const dedupeKey = `${issue.kind || "unknown"}|${issue.key || ""}|${issue.message || ""}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const entry = {
        kind: issue.kind || "DictionaryIssue",
        severity: issue.severity === "error" ? "error" : "warning",
        message: issue.message || String(issue),
        key: issue.key,
      };
      if (entry.severity === "error") this.errors.push(entry);
      else this.warnings.push(entry);
    };

    (dictionary.errors || []).forEach(add);
    (dictionary.warnings || []).forEach(add);
  }

  analyzeConceptualIssues() {
    const files = [...this.loadedFiles.entries()].map(([absPath, entry]) => ({
      absPath,
      relPath: entry.relPath,
      text: entry.text,
    }));

    const issues = analyzeCrossOntologyDuplicates(files, { includeBenign: true, renames: this.loadTimeRenames });
    for (const issue of issues) {
      this.warnings.push({
        kind: issue.kind,
        severity: "warning",
        message: issue.message,
        key: issue.key,
      });
    }
  }

  #buildResult(result) {
    const countsByKind = new Map(); // kind -> { error, warning }
    const bump = (issue) => {
      const kind = issue.kind || "UnknownIssue";
      const severity = issue.severity === "error" ? "error" : "warning";
      if (!countsByKind.has(kind)) countsByKind.set(kind, { error: 0, warning: 0 });
      countsByKind.get(kind)[severity] += 1;
    };
    this.errors.forEach(bump);
    this.warnings.forEach(bump);

    const sortedKinds = [...countsByKind.keys()].sort((a, b) => a.localeCompare(b));
    result.counts = sortedKinds.map((kind) => ({
      kind,
      errors: countsByKind.get(kind).error,
      warnings: countsByKind.get(kind).warning,
    }));

    result.errors = this.errors;
    result.warnings = this.warnings;
    result.summary.filesLoaded = this.loadOrder.length;
    result.summary.totalErrors = this.errors.length;
    result.summary.totalWarnings = this.warnings.length;
    result.loadedFiles = this.loadOrder.map((absPath) => {
      const entry = this.loadedFiles.get(absPath);
      return {
        relPath: entry?.relPath ?? path.relative(this.rootDir, absPath).replace(/\\/g, "/"),
        parseSuccess: Boolean(entry?.parseSuccess),
      };
    });

    result.success = this.errors.length === 0;
    return result;
  }
}

function renderFinalReport(runResults, meta = {}) {
  const color = createColor({ enabled: meta.colorEnabled });
  const lines = [];
  lines.push(color.cyan("======================================================================"));
  lines.push(color.cyan("CNL Theory Check Report (multi-entrypoint)"));
  lines.push(color.cyan("======================================================================"));
  lines.push("");

  if (meta.missing?.length) {
    lines.push(color.yellow("NOTE: Some default entrypoints were missing and were skipped:"));
    meta.missing.forEach((m) => lines.push(`- ${m}`));
    lines.push("");
  }

  lines.push(color.bold("Legend (issue kinds and likely consequences)"));
  const legend = legendRows();
  const legendSeverityByKind = new Map(legend.map(([kind, severity]) => [kind, severity]));
  lines.push(
    renderTable(
      ["Kind", "Severity", "Likely consequence", "Typical action"],
      legend.map(([kind, severity, consequence, action]) => {
        const s = severity === "error" ? color.red(severity) : color.yellow(severity);
        const k = severity === "error" ? color.red(kind) : color.yellow(kind);
        return [k, s, consequence, action];
      }),
    ),
  );
  lines.push("");

  for (const r of runResults) {
    lines.push("-".repeat(70));
    lines.push(color.bold(`Entrypoint: ${r.entrypoint}`));
    lines.push(`Files loaded: ${r.summary.filesLoaded}`);
    lines.push(
      `Total errors: ${
        r.summary.totalErrors === 0 ? color.green(String(r.summary.totalErrors)) : color.red(String(r.summary.totalErrors))
      }`,
    );
    lines.push(
      `Total warnings: ${
        r.summary.totalWarnings === 0 ? color.green(String(r.summary.totalWarnings)) : color.yellow(String(r.summary.totalWarnings))
      }`,
    );
    lines.push("");

    const allKinds = new Set();
    legend.forEach(([kind]) => allKinds.add(kind));
    (r.counts || []).forEach((c) => allKinds.add(c.kind));
    const orderedKinds = [...allKinds].sort((a, b) => a.localeCompare(b));

    const errorsByKind = new Map();
    const warningsByKind = new Map();
    (r.counts || []).forEach((c) => {
      if (c.errors) errorsByKind.set(c.kind, c.errors);
      if (c.warnings) warningsByKind.set(c.kind, c.warnings);
    });

    const issueRows = [];
    for (const kind of orderedKinds) {
      const errorCount = errorsByKind.get(kind) ?? 0;
      const warningCount = warningsByKind.get(kind) ?? 0;
      const total = errorCount + warningCount;
      const severity = legendSeverityByKind.get(kind) ?? (errorCount > 0 ? "error" : "warning");
      if (color.enabled) {
        const kindCell = severity === "error" ? color.red(kind) : color.yellow(kind);
        const countCell = total === 0 ? color.green(String(total)) : severity === "error" ? color.red(String(total)) : color.yellow(String(total));
        issueRows.push([kindCell, countCell]);
      } else {
        const prefix = severity === "error" ? "ERROR" : "WARN";
        issueRows.push([`${prefix}:${kind}`, String(total)]);
      }
    }

    lines.push(color.dim("Issues by kind (green=0, red=errors, yellow=warnings)"));
    lines.push(renderTable(["Kind", "Count"], issueRows));
    lines.push("");

    if (meta.verbose) {
      lines.push("Loaded files:");
      r.loadedFiles.forEach((f) => {
        const status = f.parseSuccess ? "OK" : "PARSE_ERROR";
        lines.push(`- [${status}] ${f.relPath}`);
      });
      lines.push("");

      if (r.errors.length > 0) {
        lines.push("Sample errors (first 10):");
        r.errors.slice(0, 10).forEach((e) => lines.push(`- [${e.kind}] ${e.message}`));
        lines.push("");
      }
      if (r.warnings.length > 0) {
        lines.push("Sample warnings (first 10):");
        r.warnings.slice(0, 10).forEach((w) => lines.push(`- [${w.kind}] ${w.message}`));
        lines.push("");
      }
    }
  }

  const summaryRows = runResults.map((r) => [
    r.entrypoint,
    String(r.summary.filesLoaded),
    r.summary.totalErrors === 0 ? color.green(String(r.summary.totalErrors)) : color.red(String(r.summary.totalErrors)),
    r.summary.totalWarnings === 0 ? color.green(String(r.summary.totalWarnings)) : color.yellow(String(r.summary.totalWarnings)),
  ]);
  lines.push(color.bold("Summary per entrypoint"));
  lines.push(renderTable(["Entrypoint", "Files loaded", "Errors", "Warnings"], summaryRows));
  lines.push("");

  const success = runResults.every((r) => r.success);
  lines.push(success ? color.green("Result: PASS (no errors)") : color.red("Result: FAIL (errors detected)"));
  lines.push("");
  return { report: lines.join("\n"), success };
}

// Main entry point
if (process.argv[1].endsWith("check-theories.mjs")) {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const rootDir = process.cwd();
  const selection = selectEntrypoints(args, rootDir);
  const entrypoints = selection.existing;

  const progressColor = createColor({ enabled: !args.outputFile });
  const runResults = [];
  for (const entrypoint of entrypoints) {
    console.log(`\n${progressColor.cyan("▶")} ${progressColor.bold("Checking")} ${entrypoint}`);
    const checker = new TheoryChecker({ rootDir, verbose: args.verbose });
    const res = checker.check(entrypoint);
    const errText = res.summary.totalErrors === 0 ? progressColor.green(res.summary.totalErrors) : progressColor.red(res.summary.totalErrors);
    const warnText =
      res.summary.totalWarnings === 0 ? progressColor.green(res.summary.totalWarnings) : progressColor.yellow(res.summary.totalWarnings);
    console.log(`  Loaded files: ${res.summary.filesLoaded}`);
    console.log(`  Errors: ${errText} | Warnings: ${warnText}`);
    runResults.push(res);
  }

  const final = renderFinalReport(runResults, {
    missing: selection.missing,
    verbose: args.verbose,
    colorEnabled: !args.outputFile,
  });

  if (args.outputFile) {
    fs.writeFileSync(args.outputFile, final.report, "utf8");
    console.log(`\nReport written to ${args.outputFile}`);
  } else {
    console.log("\n" + final.report);
  }

  process.exit(final.success ? 0 : 1);
}

export { TheoryChecker };
