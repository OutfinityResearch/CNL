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
    const absPath = path.resolve(this.rootDir, entrypoint);
    
    // Phase 1: Collect all files via Load directives
    this.collectFiles(absPath);
    
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
    // Analyze declarations for duplicates and conflicts using text patterns
    const typeDeclarations = new Map(); // key -> [{ file }]
    const predicateDeclarations = new Map();
    const subtypeDeclarations = []; // { child, parent, file }
    
    // Patterns for matching declarations
    const typePattern = /^"([^"]+)"\s+is\s+a\s+type\s*\./i;
    const unaryPredicatePattern = /^"([^"]+)"\s+is\s+a\s+"unary predicate"\s*\./i;
    const binaryPredicatePattern = /^"([^"]+)"\s+is\s+a\s+"binary predicate"\s*\./i;
    const subtypePattern = /^"([^"]+)"\s+is\s+a\s+subtype\s+of\s+"([^"]+)"\s*\./i;
    const domainPattern = /^the\s+domain\s+of\s+"([^"]+)"\s+is\s+"([^"]+)"\s*\./i;
    const rangePattern = /^the\s+range\s+of\s+"([^"]+)"\s+is\s+"([^"]+)"\s*\./i;
    
    for (const filePath of this.loadOrder) {
      const entry = this.loadedFiles.get(filePath);
      const lines = entry.text.split("\n");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("//") || line.startsWith("---")) continue;
        
        // Check for type declarations
        let match = line.match(typePattern);
        if (match) {
          const key = match[1];
          if (!typeDeclarations.has(key)) {
            typeDeclarations.set(key, []);
          }
          typeDeclarations.get(key).push({ file: entry.relPath, line: i + 1 });
        }
        
        // Check for binary predicate declarations
        match = line.match(binaryPredicatePattern);
        if (match) {
          const key = match[1];
          if (!predicateDeclarations.has(key)) {
            predicateDeclarations.set(key, []);
          }
          predicateDeclarations.get(key).push({ file: entry.relPath, line: i + 1, type: "binary" });
        }
        
        // Check for subtype declarations
        match = line.match(subtypePattern);
        if (match) {
          const child = match[1];
          const parent = match[2];
          subtypeDeclarations.push({ child, parent, file: entry.relPath, line: i + 1 });
        }
      }
    }
    
    // Find duplicates
    for (const [key, locs] of typeDeclarations) {
      if (locs.length > 1) {
        this.duplicateTypes.set(key, locs);
        const fileList = [...new Set(locs.map(l => l.file))].join(", ");
        this.warnings.push({
          kind: "DUPLICATE_TYPE",
          severity: "warning",
          message: `Type "${key}" declared ${locs.length} times in: ${fileList}`,
        });
      }
    }
    
    for (const [key, locs] of predicateDeclarations) {
      if (locs.length > 1) {
        this.duplicatePredicates.set(key, locs);
        const fileList = [...new Set(locs.map(l => l.file))].join(", ");
        this.warnings.push({
          kind: "DUPLICATE_PREDICATE",
          severity: "warning",
          message: `Predicate "${key}" declared ${locs.length} times in: ${fileList}`,
        });
      }
    }
    
    // Find type/predicate conflicts
    for (const key of typeDeclarations.keys()) {
      if (predicateDeclarations.has(key)) {
        this.typePredicateConflicts.push(key);
        this.warnings.push({
          kind: "TYPE_PREDICATE_CONFLICT",
          severity: "warning",
          message: `"${key}" is declared both as a type and as a binary predicate`,
        });
      }
    }
    
    // Find reflexive subtypes
    for (const { child, parent, file, line } of subtypeDeclarations) {
      if (child === parent) {
        this.reflexiveSubtypes.push({ type: child, file, line });
        this.warnings.push({
          kind: "REFLEXIVE_SUBTYPE",
          severity: "warning",
          message: `Reflexive subtype: "${child}" is a subtype of itself (${file}:${line})`,
        });
      }
    }
    
    // Find cyclic subtypes
    const subtypeGraph = new Map();
    for (const { child, parent } of subtypeDeclarations) {
      if (child === parent) continue; // Skip reflexive for cycle detection
      if (!subtypeGraph.has(child)) {
        subtypeGraph.set(child, new Set());
      }
      subtypeGraph.get(child).add(parent);
    }
    
    const findCycle = (start, current, path) => {
      if (current === start && path.length > 0) return [...path, start];
      if (path.includes(current)) return null;
      const parents = subtypeGraph.get(current);
      if (!parents) return null;
      for (const parent of parents) {
        const cycle = findCycle(start, parent, [...path, current]);
        if (cycle) return cycle;
      }
      return null;
    };
    
    const reportedCycles = new Set();
    for (const node of subtypeGraph.keys()) {
      const cycle = findCycle(node, node, []);
      if (cycle && cycle.length > 2) {
        const cycleKey = [...cycle].sort().join(",");
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          this.cyclicSubtypes.push(cycle);
          this.warnings.push({
            kind: "CYCLIC_SUBTYPE",
            severity: "warning",
            message: `Cyclic subtype chain: ${cycle.join(" -> ")}`,
          });
        }
      }
    }
    
    // Find non-English labels
    const nonEnglishPatterns = [
      { pattern: /^sello-de-/, lang: "Spanish" },
      { pattern: /^sistema-de-/, lang: "Spanish" },
      { pattern: /^tipo-de-/, lang: "Spanish" },
      { pattern: /^dia$/, lang: "Spanish" },
    ];
    
    for (const key of [...typeDeclarations.keys(), ...predicateDeclarations.keys()]) {
      for (const { pattern, lang } of nonEnglishPatterns) {
        if (pattern.test(key)) {
          this.nonEnglishLabels.push({ key, lang });
          this.warnings.push({
            kind: "NON_ENGLISH_LABEL",
            severity: "warning",
            message: `Non-English label (${lang}) detected: "${key}"`,
          });
          break;
        }
      }
    }
    
    // Check for hash-like generated names
    const hashPattern = /^term-[a-f0-9]{8,}$/i;
    for (const key of typeDeclarations.keys()) {
      if (hashPattern.test(key)) {
        this.warnings.push({
          kind: "HASH_NAME",
          severity: "warning",
          message: `Hash-based type name detected: "${key}" - consider providing a readable label`,
        });
      }
    }
    
    // Check for numeric ID names (like bfo-0000050, obi-0000011)
    const numericIdPattern = /^(bfo|ro|obi|cob|chebi|iao)-\d+$/i;
    for (const key of [...typeDeclarations.keys(), ...predicateDeclarations.keys()]) {
      if (numericIdPattern.test(key)) {
        this.warnings.push({
          kind: "NUMERIC_ID_NAME",
          severity: "warning",
          message: `Numeric ID used as name: "${key}" - consider using rdfs:label instead`,
        });
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
