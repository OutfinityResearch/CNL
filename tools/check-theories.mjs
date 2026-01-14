#!/usr/bin/env node
/**
 * checkTheories - Static file checker for CNL theory files.
 *
 * Scans all files loaded via Load: directives starting from an entrypoint,
 * parses them, and reports errors/warnings.
 *
 * Usage:
 *   node tools/check-theories.mjs [--entrypoint theories/base.cnl] [-f output.txt]
 */

import fs from "node:fs";
import path from "node:path";
import { parseProgram } from "../src/parser/grammar.mjs";
import { createCompilerState, compileProgram } from "../src/compiler/compile.mjs";
import { analyzeCrossOntologyDuplicates, expandTheoryEntrypoint } from "../src/theories/diagnostics.mjs";

const LOAD_DIRECTIVE_RE = /^\s*Load\s*:\s*"([^"]+)"\s*\.\s*$/i;

function parseArgs(argv) {
  const args = {
    entrypoint: "theories/base.cnl",
    outputFile: null,
    help: false,
    verbose: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--entrypoint" || raw === "-e") {
      args.entrypoint = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--entrypoint=")) {
      args.entrypoint = raw.slice("--entrypoint=".length);
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
  return `checkTheories - Static file checker for CNL theory files.

Usage:
  node tools/check-theories.mjs [options]

Options:
  --entrypoint, -e <file>   Entrypoint file (default: theories/base.cnl)
  --output, -f <file>       Write report to file instead of stdout
  --verbose, -v             Show verbose output including loaded files
  --help, -h                Show this help message

Examples:
  node tools/check-theories.mjs
  node tools/check-theories.mjs -e theories/base.formal.cnl
  node tools/check-theories.mjs -f report.txt
`;
}

function resolveLoadPath(raw, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const baseDir = source ? path.dirname(source) : rootDir;
  const cleaned = String(raw || "").trim();
  if (!cleaned) {
    throw new Error("Empty load path.");
  }

  const abs = path.isAbsolute(cleaned)
    ? cleaned
    : cleaned.startsWith("./") || cleaned.startsWith("../")
      ? path.resolve(baseDir, cleaned)
      : path.resolve(rootDir, cleaned);

  return path.resolve(abs);
}

class TheoryChecker {
  constructor(options = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.verbose = options.verbose ?? false;
    this.loadedFiles = new Map(); // path -> { text, errors, warnings }
    this.loadOrder = [];
    this.errors = [];
    this.warnings = [];
    this.duplicateTypes = new Map();
    this.duplicatePredicates = new Map();
    this.typePredicateConflicts = [];
    this.cyclicSubtypes = [];
    this.reflexiveSubtypes = [];
    this.nonEnglishLabels = [];
  }

  check(entrypoint) {
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
      return this.generateReport();
    }

    this.loadedFiles.clear();
    this.loadOrder.length = 0;
    for (const f of expanded.files) {
      this.loadedFiles.set(f.absPath, { text: f.text, relPath: f.relPath, errors: [], warnings: [] });
      this.loadOrder.push(f.absPath);
    }
    
    // Phase 2: Parse each file individually and collect errors
    this.parseFiles();
    
    // Phase 3: Compile all together and check for semantic issues
    this.compileAndCheck();
    
    // Phase 4: Analyze for conceptual issues
    this.analyzeConceptualIssues();
    
    return this.generateReport();
  }

  collectFiles(filePath, visited = new Set()) {
    if (visited.has(filePath)) {
      this.warnings.push({
        kind: "CYCLIC_LOAD",
        severity: "warning",
        message: `Cyclic Load detected: ${path.relative(this.rootDir, filePath)}`,
        file: filePath,
      });
      return;
    }
    
    if (!fs.existsSync(filePath)) {
      this.errors.push({
        kind: "FILE_NOT_FOUND",
        severity: "error",
        message: `File not found: ${path.relative(this.rootDir, filePath)}`,
        file: filePath,
      });
      return;
    }
    
    visited.add(filePath);
    
    const text = fs.readFileSync(filePath, "utf8");
    const relPath = path.relative(this.rootDir, filePath);
    this.loadedFiles.set(filePath, { text, relPath, errors: [], warnings: [] });
    this.loadOrder.push(filePath);
    
    // Find Load directives
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(LOAD_DIRECTIVE_RE);
      if (match) {
        try {
          const loadPath = resolveLoadPath(match[1], { rootDir: this.rootDir, source: filePath });
          this.collectFiles(loadPath, visited);
        } catch (err) {
          this.errors.push({
            kind: "LOAD_ERROR",
            severity: "error",
            message: `Failed to resolve Load path "${match[1]}": ${err.message}`,
            file: filePath,
            line: i + 1,
          });
        }
      }
    }
  }

  parseFiles() {
    for (const filePath of this.loadOrder) {
      const entry = this.loadedFiles.get(filePath);
      // Remove Load directives for parsing (line by line)
      const lines = entry.text.split("\n");
      const cleanedLines = lines.map(line => {
        if (LOAD_DIRECTIVE_RE.test(line)) {
          return "// (Load removed for parsing)";
        }
        return line;
      });
      const textWithoutLoads = cleanedLines.join("\n");
      
      try {
        const ast = parseProgram(textWithoutLoads);
        entry.ast = ast;
        entry.parseSuccess = true;
      } catch (err) {
        entry.parseSuccess = false;
        entry.errors.push({
          type: "PARSE_ERROR",
          message: err.message || "Parse error",
          details: err,
        });
        this.errors.push({
          kind: "PARSE_ERROR",
          severity: "error",
          message: `Parse error in ${entry.relPath}: ${err.message || "Unknown error"}`,
          file: filePath,
        });
      }
    }
  }

  compileAndCheck() {
    const state = createCompilerState({
      validateDictionary: true,
      projectEntityAttributes: false,
    });
    
    // Compile all files in order
    for (const filePath of this.loadOrder) {
      const entry = this.loadedFiles.get(filePath);
      if (!entry.ast) continue;
      
      state.errors.length = 0;
      compileProgram(entry.ast, {
        state,
        projectEntityAttributes: false,
      });
      
      if (state.errors.length > 0) {
        for (const err of state.errors) {
          entry.errors.push({
            type: "COMPILE_ERROR",
            message: err.message || String(err),
            details: err,
          });
          this.errors.push({
            kind: "COMPILE_ERROR",
            severity: "error",
            message: `Compile error in ${entry.relPath}: ${err.message || String(err)}`,
            file: filePath,
          });
        }
      }
    }
    
    this.compiledState = state;
  }

  analyzeConceptualIssues() {
    const files = [...this.loadedFiles.entries()].map(([absPath, entry]) => ({
      absPath,
      relPath: entry.relPath,
      text: entry.text,
    }));

    const issues = analyzeCrossOntologyDuplicates(files, { includeBenign: true });
    for (const i of issues) {
      this.warnings.push({ kind: i.kind, severity: i.severity, message: i.message });
      if (i.kind.startsWith("DuplicateType")) {
        this.duplicateTypes.set(i.key, i.details?.files || []);
      }
      if (i.kind.startsWith("DuplicatePredicate")) {
        this.duplicatePredicates.set(i.key, i.details?.files || []);
      }
    }
  }

  generateReport() {
    const lines = [];
    
    lines.push("=" .repeat(70));
    lines.push("CNL Theory Check Report");
    lines.push("=" .repeat(70));
    lines.push("");
    lines.push(`Entrypoint: ${this.loadOrder[0] ? path.relative(this.rootDir, this.loadOrder[0]) : "N/A"}`);
    lines.push(`Files loaded: ${this.loadOrder.length}`);
    lines.push(`Total errors: ${this.errors.length}`);
    lines.push(`Total warnings: ${this.warnings.length}`);
    lines.push("");
    
    if (this.verbose) {
      lines.push("-".repeat(70));
      lines.push("LOADED FILES:");
      lines.push("-".repeat(70));
      for (const filePath of this.loadOrder) {
        const entry = this.loadedFiles.get(filePath);
        const status = entry.parseSuccess ? "OK" : "PARSE_ERROR";
        lines.push(`  [${status}] ${entry.relPath}`);
      }
      lines.push("");
    }
    
    if (this.errors.length > 0) {
      lines.push("-".repeat(70));
      lines.push("ERRORS:");
      lines.push("-".repeat(70));
      for (const err of this.errors) {
        lines.push(`  [${err.kind}] ${err.message}`);
      }
      lines.push("");
    }
    
    if (this.warnings.length > 0) {
      lines.push("-".repeat(70));
      lines.push("WARNINGS:");
      lines.push("-".repeat(70));
      
      // Group by kind
      const byKind = new Map();
      for (const warn of this.warnings) {
        if (!byKind.has(warn.kind)) {
          byKind.set(warn.kind, []);
        }
        byKind.get(warn.kind).push(warn);
      }
      
      for (const [kind, warns] of byKind) {
        lines.push(`\n  ${kind} (${warns.length}):`);
        for (const warn of warns.slice(0, 20)) {
          lines.push(`    - ${warn.message}`);
        }
        if (warns.length > 20) {
          lines.push(`    ... and ${warns.length - 20} more`);
        }
      }
      lines.push("");
    }
    
    lines.push("-".repeat(70));
    lines.push("SUMMARY:");
    lines.push("-".repeat(70));
    lines.push(`  Duplicate types: ${this.duplicateTypes.size}`);
    lines.push(`  Duplicate predicates: ${this.duplicatePredicates.size}`);
    lines.push(`  Type/predicate conflicts: ${this.typePredicateConflicts.length}`);
    lines.push(`  Reflexive subtypes: ${this.reflexiveSubtypes.length}`);
    lines.push(`  Cyclic subtype chains: ${this.cyclicSubtypes.length}`);
    lines.push(`  Non-English labels: ${this.nonEnglishLabels.length}`);
    lines.push("");
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      lines.push("All checks passed.");
    } else if (this.errors.length === 0) {
      lines.push("No errors found, but there are warnings to review.");
    } else {
      lines.push("Errors found - theory loading may fail.");
    }
    
    lines.push("");
    
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        filesLoaded: this.loadOrder.length,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        duplicateTypes: this.duplicateTypes.size,
        duplicatePredicates: this.duplicatePredicates.size,
        typePredicateConflicts: this.typePredicateConflicts.length,
        reflexiveSubtypes: this.reflexiveSubtypes.length,
        cyclicSubtypes: this.cyclicSubtypes.length,
        nonEnglishLabels: this.nonEnglishLabels.length,
      },
      report: lines.join("\n"),
    };
  }
}

// Main entry point
if (process.argv[1].endsWith("check-theories.mjs")) {
  const args = parseArgs(process.argv);
  
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  
  const checker = new TheoryChecker({
    rootDir: process.cwd(),
    verbose: args.verbose,
  });
  
  const result = checker.check(args.entrypoint);
  
  if (args.outputFile) {
    fs.writeFileSync(args.outputFile, result.report, "utf8");
    console.log(`Report written to ${args.outputFile}`);
  } else {
    console.log(result.report);
  }
  
  process.exit(result.success ? 0 : 1);
}

export { TheoryChecker };
