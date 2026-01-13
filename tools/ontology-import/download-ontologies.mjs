import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {
    ontologiesDir: "ontologies",
    only: null,
    skipDownload: false,
    skipConvert: false,
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
    if (raw === "--only") {
      args.only = argv[i + 1];
      i += 1;
      continue;
    }
    if (raw.startsWith("--only=")) {
      args.only = raw.slice("--only=".length);
      continue;
    }
    if (raw === "--skipDownload") {
      args.skipDownload = true;
      continue;
    }
    if (raw === "--skipConvert") {
      args.skipConvert = true;
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
    "Download selected classic ontologies and convert them to Turtle (.ttl).",
    "",
    "Requires:",
    "- network access (curl)",
    "- raptor2 tools (rapper) for RDF/XML -> Turtle conversion",
    "",
    "Usage:",
    "  node tools/ontology-import/download-ontologies.mjs [--ontologiesDir ontologies] [--only foaf,wgs84] ",
    "",
    "Flags:",
    "  --skipDownload   (assumes source files already exist)",
    "  --skipConvert    (do not run conversion; writes only SOURCE.md)",
    "",
  ].join("\n");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

const CATALOG = [
  {
    id: "foaf",
    title: "FOAF Vocabulary Specification",
    sourceUrl: "https://xmlns.com/foaf/spec/index.rdf",
    sourceFormat: "rdfxml",
    outTtl: "foaf.ttl",
  },
  {
    id: "wgs84",
    title: "WGS84 Geo Positioning (W3C Basic Geo)",
    sourceUrl: "https://www.w3.org/2003/01/geo/wgs84_pos.rdf",
    sourceFormat: "rdfxml",
    outTtl: "wgs84_pos.ttl",
  },
  {
    id: "geosparql",
    title: "OGC GeoSPARQL Ontology",
    sourceUrl: "https://schemas.opengis.net/geosparql/1.1/geosparql.ttl",
    sourceFormat: "turtle",
    outTtl: "geosparql.ttl",
  },
  {
    id: "dul",
    title: "DOLCE+DnS Ultra Lite (DUL)",
    sourceUrl: "https://www.ontologydesignpatterns.org/ont/dul/DUL.owl",
    sourceFormat: "rdfxml",
    outTtl: "dul.ttl",
  },
  {
    id: "bfo",
    title: "Basic Formal Ontology (BFO)",
    sourceUrl: "https://purl.obolibrary.org/obo/bfo.owl",
    sourceFormat: "rdfxml",
    outTtl: "bfo.ttl",
  },
  {
    id: "ro",
    title: "OBO Relation Ontology (RO)",
    sourceUrl: "https://purl.obolibrary.org/obo/ro.owl",
    sourceFormat: "rdfxml",
    outTtl: "ro.ttl",
  },
  {
    id: "iao",
    title: "Information Artifact Ontology (IAO)",
    sourceUrl: "https://purl.obolibrary.org/obo/iao.owl",
    sourceFormat: "rdfxml",
    outTtl: "iao.ttl",
  },
];

function selectCatalog(only) {
  if (!only) return CATALOG;
  const wanted = new Set(
    String(only)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return CATALOG.filter((c) => wanted.has(c.id));
}

function downloadTo(url, outPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnl-onto-dl-"));
  const tmpPath = path.join(tmpDir, path.basename(outPath) + ".download");
  run("curl", ["-fsSL", "--retry", "3", "--retry-delay", "2", "-o", tmpPath, url]);
  ensureDir(path.dirname(outPath));
  fs.renameSync(tmpPath, outPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function convertRdfxmlToTurtle(inPath, outPath) {
  ensureDir(path.dirname(outPath));
  const outFd = fs.openSync(outPath, "w");
  try {
    const result = spawnSync("rapper", ["-q", "-i", "rdfxml", "-o", "turtle", inPath], {
      stdio: ["ignore", outFd, "inherit"],
    });
    if (result.status !== 0) {
      throw new Error(`Conversion failed: rapper -i rdfxml -o turtle ${inPath}`);
    }
  } finally {
    fs.closeSync(outFd);
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeSourceMd(folder, entry, sourceFile, ttlFile) {
  const lines = [];
  lines.push(`# Source: ${entry.title}`);
  lines.push("");
  lines.push(`- id: \`${entry.id}\``);
  lines.push(`- downloadedAt: \`${nowIso()}\``);
  lines.push(`- url: ${entry.sourceUrl}`);
  lines.push(`- sourceFormat: \`${entry.sourceFormat}\``);
  lines.push(`- sourceFile: \`${path.basename(String(sourceFile))}\``);
  if (ttlFile && typeof ttlFile === "string" && ttlFile.startsWith("(")) {
    lines.push(`- ttlFile: ${ttlFile}`);
  } else {
    lines.push(`- ttlFile: \`${path.basename(String(ttlFile))}\``);
  }
  lines.push("");
  lines.push("Notes:");
  lines.push("- This repository vendors a Turtle snapshot for deterministic imports.");
  lines.push("- Licensing/attribution is governed by the upstream ontology source.");
  lines.push("");
  writeText(path.join(folder, "SOURCE.md"), lines.join("\n"));
}

export function downloadOntologies(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const args = options.args ?? {};
  const ontologiesDir = path.resolve(cwd, args.ontologiesDir ?? "ontologies");
  const selected = selectCatalog(args.only);

  if (selected.length === 0) {
    return { ok: false, error: "No ontologies selected." };
  }

  const results = [];
  for (const entry of selected) {
    const folder = path.join(ontologiesDir, entry.id);
    ensureDir(folder);

    const ttlPath = path.join(folder, entry.outTtl);
    const sourceExt = entry.sourceFormat === "turtle" ? "ttl" : entry.sourceFormat === "rdfxml" ? "rdf" : "src";
    const sourcePath =
      entry.sourceFormat === "turtle" ? ttlPath : path.join(folder, `source.${sourceExt}`);

    if (!args.skipDownload) {
      downloadTo(entry.sourceUrl, sourcePath);
    }

    const hasTtl = exists(ttlPath);
    const needsConvert = entry.sourceFormat === "rdfxml" && !args.skipConvert;
    if (needsConvert) {
      convertRdfxmlToTurtle(sourcePath, ttlPath);
    }

    const ttlExists = exists(ttlPath);
    writeSourceMd(folder, entry, sourcePath, ttlExists ? ttlPath : "(not converted yet)");
    results.push({
      id: entry.id,
      sourcePath: path.relative(cwd, sourcePath),
      ttlPath: ttlExists ? path.relative(cwd, ttlPath) : null,
    });
  }

  return { ok: true, count: results.length, results };
}

if (import.meta.url === pathToFileURL(path.resolve(process.cwd(), process.argv[1])).href) {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  const result = downloadOntologies({ cwd: process.cwd(), args });
  if (!result.ok) {
    console.error(`ERROR: ${result.error || "failed"}`);
    process.exit(1);
  }
  console.log(`OK: downloaded ${result.count} ontology source(s).`);
  for (const r of result.results) {
    console.log(`- ${r.id}: ${r.ttlPath}`);
  }
}
