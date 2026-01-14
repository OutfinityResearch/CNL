import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runImport } from "./import.mjs";

function toContextName(id) {
  const parts = String(id || "")
    .trim()
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  if (parts.length === 0) return "ImportedOntology";
  const capped = parts.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1));
  const joined = capped.join("");
  return /^[A-Za-z_]/.test(joined) ? joined : `Ontology${joined}`;
}

function parseArgs(argv) {
  const args = {
    ontologiesDir: "ontologies",
    defaultOutRoot: "theories/ontologies",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--ontologiesDir") {
      args.ontologiesDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--ontologiesDir=")) {
      args.ontologiesDir = raw.slice("--ontologiesDir=".length);
      continue;
    }
    if (raw === "--outRoot") {
      args.defaultOutRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--outRoot=")) {
      args.defaultOutRoot = raw.slice("--outRoot=".length);
      continue;
    }
    if (raw === "--help" || raw === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${raw}`);
  }
  return args;
}

function usage() {
  return [
    "Generate all CNL theories from local ontologies.",
    "",
    "Usage:",
    "  node tools/ontology-import/generate-theories.mjs [--ontologiesDir ontologies] [--outRoot theories/ontologies]",
    "",
  ].join("\n");
}

function listOntologyFolders(dir) {
  const folders = [];
  if (!fs.existsSync(dir)) return folders;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory()) continue;
    folders.push(path.join(dir, entry.name));
  }
  folders.sort();
  return folders;
}

function listInputs(folder) {
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".ttl"))
    .map((e) => e.name)
    .sort();
}

export function generateAllTheories(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const ontologiesDir = path.resolve(cwd, options.ontologiesDir ?? "ontologies");
  const defaultOutRoot = options.defaultOutRoot ?? "theories/ontologies";

  const results = [];
  const folders = listOntologyFolders(ontologiesDir);
  let skipped = 0;

  for (const folder of folders) {
    const id = path.basename(folder);
    const context = toContextName(id);
    const inputs = listInputs(folder);
    if (inputs.length === 0) {
      skipped += 1;
      continue;
    }

    const outDir = path.join(defaultOutRoot, id);
    const inPaths = inputs.map((name) => path.relative(cwd, path.join(folder, name)));

    const result = runImport({ in: inPaths, out: outDir, context, prefix: "", ontologyId: id });
    const entry = {
      id,
      context,
      outDir: outDir,
      inputs: inPaths,
      files: result.files,
      removedDuplicates: result.removedDuplicates,
      counts: result.counts,
    };

    results.push(entry);
  }

  return { ok: true, count: results.length, skipped, results };
}

if (import.meta.url === pathToFileURL(path.resolve(process.cwd(), process.argv[1])).href) {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const run = generateAllTheories(args);
  console.log(`OK: generated theories for ${run.count} ontologies.`);
  for (const item of run.results) {
    console.log(`- ${item.id}: ${item.files.dictGeneratedPath}, ${item.files.rulesGeneratedPath}`);
  }
}
