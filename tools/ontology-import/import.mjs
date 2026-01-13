import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseTurtleToTriples } from "./lib/turtle.mjs";
import { extractOntologySchema } from "./lib/extract.mjs";
import { renderOntologyCnl } from "./lib/render.mjs";
import { dedupeExtraFile, ensureExtraFile, writeGeneratedFile } from "./lib/extra.mjs";

function parseArgs(argv) {
  const args = { in: [], out: null, context: "ImportedOntology" };
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === "--in") {
      args.in.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (raw.startsWith("--in=")) {
      args.in.push(raw.slice("--in=".length));
      continue;
    }
    if (raw === "--out") {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--out=")) {
      args.out = raw.slice("--out=".length);
      continue;
    }
    if (raw === "--context") {
      args.context = argv[i + 1] || args.context;
      i += 1;
      continue;
    }
    if (raw.startsWith("--context=")) {
      args.context = raw.slice("--context=".length) || args.context;
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
    "Ontology import tool (RDF/RDFS/OWL subset) -> CNL (.generated/.extra)",
    "",
    "Usage:",
    "  node tools/ontology-import/import.mjs --in <file.ttl> [--in <file2.ttl> ...] --out <dir> [--context Name]",
    "",
    "Outputs:",
    "  <dir>/00-dictionary.generated.cnl",
    "  <dir>/00-dictionary.extra.cnl",
    "  <dir>/01-rules.generated.cnl",
    "  <dir>/01-rules.extra.cnl",
    "",
  ].join("\n");
}

export function runImport(options) {
  const inputFiles = options?.in ?? [];
  const outDir = options?.out ?? null;
  const context = options?.context ?? "ImportedOntology";

  if (!outDir) throw new Error("Missing --out <dir>.");
  if (!Array.isArray(inputFiles) || inputFiles.length === 0) throw new Error("At least one --in <file> is required.");

  const sources = inputFiles.map((p) => path.resolve(process.cwd(), p));
  const texts = sources.map((p) => fs.readFileSync(p, "utf8"));
  const triples = texts.flatMap((text) => parseTurtleToTriples(text));
  const schema = extractOntologySchema(triples);
  const rendered = renderOntologyCnl(schema, { context });

  const dictGeneratedPath = path.join(outDir, "00-dictionary.generated.cnl");
  const dictExtraPath = path.join(outDir, "00-dictionary.extra.cnl");
  const rulesGeneratedPath = path.join(outDir, "01-rules.generated.cnl");
  const rulesExtraPath = path.join(outDir, "01-rules.extra.cnl");

  const header = [
    "// This file is generated. Do not edit.",
    `// Source: ${sources.map((p) => path.relative(process.cwd(), p)).join(", ")}`,
  ];

  writeGeneratedFile(dictGeneratedPath, header.join("\n") + "\n\n" + rendered.dictionary);
  writeGeneratedFile(rulesGeneratedPath, header.join("\n") + "\n\n" + rendered.rules);

  ensureExtraFile(
    dictExtraPath,
    "--- CONTEXT: BaseDictionary ---",
    ["// Manual additions for BaseDictionary (kept across regenerations)."]
  );
  ensureExtraFile(
    rulesExtraPath,
    `--- CONTEXT: ${context}Extra ---`,
    ["// Manual additions for ontology rules (kept across regenerations)."]
  );

  const dictDedupe = dedupeExtraFile(dictExtraPath, rendered.generatedStatementKeys);
  const rulesDedupe = dedupeExtraFile(rulesExtraPath, rendered.generatedStatementKeys);

  return {
    ok: true,
    outDir,
    context,
    files: {
      dictGeneratedPath,
      dictExtraPath,
      rulesGeneratedPath,
      rulesExtraPath,
    },
    removedDuplicates: {
      dictionaryExtra: dictDedupe.removed,
      rulesExtra: rulesDedupe.removed,
    },
    counts: {
      triples: triples.length,
      classes: schema.classes.size,
      properties: schema.properties.size,
    },
  };
}

if (import.meta.url === pathToFileURL(path.resolve(process.cwd(), process.argv[1])).href) {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const result = runImport(args);
  const rel = (p) => path.relative(process.cwd(), p);
  console.log(`OK: imported ontology (${result.counts.triples} triples)`);
  console.log(`- classes: ${result.counts.classes}`);
  console.log(`- properties: ${result.counts.properties}`);
  console.log(`- wrote: ${rel(result.files.dictGeneratedPath)}`);
  console.log(`- wrote: ${rel(result.files.rulesGeneratedPath)}`);
  console.log(`- updated: ${rel(result.files.dictExtraPath)} (removed ${result.removedDuplicates.dictionaryExtra} duplicates)`);
  console.log(`- updated: ${rel(result.files.rulesExtraPath)} (removed ${result.removedDuplicates.rulesExtra} duplicates)`);
}
