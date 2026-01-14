import fs from "node:fs";
import path from "node:path";

const LOAD_DIRECTIVE_RE = /^\s*Load\s*:\s*"([^"]+)"\s*\.\s*$/i;

function isWithinRoot(rootDir, absPath) {
  const rel = path.relative(rootDir, absPath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveLoadPath(raw, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const baseDir = source ? path.dirname(source) : rootDir;
  const cleaned = String(raw || "").trim();
  if (!cleaned) throw new Error("Empty load path.");

  const abs = path.isAbsolute(cleaned)
    ? cleaned
    : cleaned.startsWith("./") || cleaned.startsWith("../")
      ? path.resolve(baseDir, cleaned)
      : path.resolve(rootDir, cleaned);

  const rootAbs = path.resolve(rootDir);
  const absNorm = path.resolve(abs);
  if (!isWithinRoot(rootAbs, absNorm)) {
    throw new Error(`Load path escapes rootDir: ${cleaned}`);
  }
  return absNorm;
}

function stripLoadDirectives(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  return (
    lines
      .map((line) => (LOAD_DIRECTIVE_RE.test(line) ? "// (Load removed)" : line))
      .join("\n") + "\n"
  );
}

function expandTextToSegments(text, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const visited = options.visited ?? new Set();
  const files = options.files ?? new Map(); // absPath -> { absPath, relPath, text }

  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const segments = [];

  let buffer = [];
  const flush = () => {
    const joined = buffer.join("\n").trimEnd();
    buffer = [];
    if (!joined) return;
    segments.push({ path: source, text: joined + "\n" });
  };

  for (const line of lines) {
    const match = line.match(LOAD_DIRECTIVE_RE);
    if (!match) {
      buffer.push(line);
      continue;
    }

    flush();

    const abs = resolveLoadPath(match[1], { rootDir, source });
    if (visited.has(abs)) throw new Error(`Cyclic/repeated Load detected: ${abs}`);
    visited.add(abs);

    const loaded = fs.readFileSync(abs, "utf8");
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    if (!files.has(abs)) {
      files.set(abs, { absPath: abs, relPath: rel, text: loaded });
    }
    const inner = expandTextToSegments(loaded, { rootDir, source: abs, visited, files });
    segments.push(...inner.segments);
  }

  flush();
  return { segments, files };
}

export function expandTheoryEntrypoint(entrypoint, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const entryAbs = path.resolve(rootDir, entrypoint);
  const entryText = fs.readFileSync(entryAbs, "utf8");
  const files = new Map();
  files.set(entryAbs, {
    absPath: entryAbs,
    relPath: path.relative(rootDir, entryAbs).replace(/\\/g, "/"),
    text: entryText,
  });

  const visited = new Set([entryAbs]);
  const expanded = expandTextToSegments(entryText, { rootDir, source: entryAbs, visited, files });

  const segments = expanded.segments
    .map((s) => ({ path: s.path, text: stripLoadDirectives(s.text) }))
    .filter((s) => s.text.trim().length > 0);

  return {
    entryAbs,
    segments,
    files: [...expanded.files.values()],
  };
}

function fileId(file) {
  return file?.relPath || file?.absPath || "unknown";
}

export function analyzeCrossOntologyDuplicates(files, options = {}) {
  const includeBenign = options.includeBenign ?? false;

  const typeDeclaredIn = new Map(); // key -> Set(fileId)
  const predicateDeclaredIn = new Map(); // key -> Set(fileId)
  const subtypeParentsByFile = new Map(); // child -> Map(fileId -> Set(parent))
  const domainByFile = new Map(); // pred -> Map(fileId -> Set(type))
  const rangeByFile = new Map(); // pred -> Map(fileId -> Set(type))

  function ensureNested(map, key) {
    if (!map.has(key)) map.set(key, new Map());
    return map.get(key);
  }
  function ensureSet(map, key) {
    if (!map.has(key)) map.set(key, new Set());
    return map.get(key);
  }

  const typePattern = /^"([^"]+)"\s+is\s+a\s+type\s*\.\s*$/i;
  const binaryPredicatePattern = /^"([^"]+)"\s+is\s+a\s+"binary predicate"\s*\.\s*$/i;
  const subtypePattern = /^"([^"]+)"\s+is\s+a\s+subtype\s+of\s+"([^"]+)"\s*\.\s*$/i;
  const domainPattern = /^the\s+domain\s+of\s+"([^"]+)"\s+is\s+"([^"]+)"\s*\.\s*$/i;
  const rangePattern = /^the\s+range\s+of\s+"([^"]+)"\s+is\s+"([^"]+)"\s*\.\s*$/i;

  for (const f of files || []) {
    const id = fileId(f);
    const lines = String(f.text || "").replace(/\r\n/g, "\n").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("//")) continue;
      if (line.startsWith("--- CONTEXT:")) continue;

      let match = line.match(typePattern);
      if (match) {
        ensureSet(typeDeclaredIn, match[1]).add(id);
        continue;
      }

      match = line.match(binaryPredicatePattern);
      if (match) {
        ensureSet(predicateDeclaredIn, match[1]).add(id);
        continue;
      }

      match = line.match(subtypePattern);
      if (match) {
        const child = match[1];
        const parent = match[2];
        const byFile = ensureNested(subtypeParentsByFile, child);
        if (!byFile.has(id)) byFile.set(id, new Set());
        byFile.get(id).add(parent);
        continue;
      }

      match = line.match(domainPattern);
      if (match) {
        const pred = match[1];
        const type = match[2];
        const byFile = ensureNested(domainByFile, pred);
        if (!byFile.has(id)) byFile.set(id, new Set());
        byFile.get(id).add(type);
        continue;
      }

      match = line.match(rangePattern);
      if (match) {
        const pred = match[1];
        const type = match[2];
        const byFile = ensureNested(rangeByFile, pred);
        if (!byFile.has(id)) byFile.set(id, new Set());
        byFile.get(id).add(type);
        continue;
      }
    }
  }

  const issues = [];

  for (const [key, fileSet] of typeDeclaredIn.entries()) {
    if (fileSet.size <= 1) continue;
    const parentByFile = subtypeParentsByFile.get(key) || new Map();
    const distinctParentSets = new Map(); // serialized -> Set(file)
    for (const [f, parents] of parentByFile.entries()) {
      const s = [...parents].sort().join(",");
      if (!distinctParentSets.has(s)) distinctParentSets.set(s, new Set());
      distinctParentSets.get(s).add(f);
    }

    const isConflict = distinctParentSets.size > 1;
    if (!isConflict && !includeBenign) continue;

    issues.push({
      kind: isConflict ? "DuplicateTypeDifferentParents" : "DuplicateTypeDeclaration",
      severity: "warning",
      key,
      message: isConflict
        ? `Type "${key}" declared in ${fileSet.size} files with different parents.`
        : `Type "${key}" declared in ${fileSet.size} files (benign duplicate).`,
      details: {
        files: [...fileSet].sort(),
        parentsByFile: [...parentByFile.entries()].map(([f, ps]) => ({ file: f, parents: [...ps].sort() })),
      },
    });
  }

  for (const [key, fileSet] of predicateDeclaredIn.entries()) {
    if (fileSet.size <= 1) continue;

    const domains = domainByFile.get(key) || new Map();
    const ranges = rangeByFile.get(key) || new Map();
    const distinctSignatures = new Map(); // signature -> Set(file)

    for (const f of fileSet) {
      const d = [...(domains.get(f) || [])].sort().join(",");
      const r = [...(ranges.get(f) || [])].sort().join(",");
      const sig = `d:${d}|r:${r}`;
      if (!distinctSignatures.has(sig)) distinctSignatures.set(sig, new Set());
      distinctSignatures.get(sig).add(f);
    }

    const isConflict = distinctSignatures.size > 1;
    if (!isConflict && !includeBenign) continue;

    issues.push({
      kind: isConflict ? "DuplicatePredicateDifferentConstraints" : "DuplicatePredicateDeclaration",
      severity: "warning",
      key,
      message: isConflict
        ? `Binary predicate "${key}" declared in ${fileSet.size} files with different domain/range constraints.`
        : `Binary predicate "${key}" declared in ${fileSet.size} files (benign duplicate).`,
      details: {
        files: [...fileSet].sort(),
        domainByFile: [...domains.entries()].map(([f, ds]) => ({ file: f, domain: [...ds].sort() })),
        rangeByFile: [...ranges.entries()].map(([f, rs]) => ({ file: f, range: [...rs].sort() })),
      },
    });
  }

  return issues.sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind);
    if (kindCmp !== 0) return kindCmp;
    return String(a.key).localeCompare(String(b.key));
  });
}

export function mergeIssuesIntoDictionaryWarnings(dictionaryState, issues, options = {}) {
  if (!dictionaryState || !Array.isArray(issues)) return 0;
  const seen = dictionaryState._issueKeys instanceof Set ? dictionaryState._issueKeys : null;
  const prefix = options.issueKeyPrefix ?? "diag";
  let added = 0;
  for (const i of issues) {
    const issueKey = `${prefix}:${i.kind}:${i.key || i.message}`;
    if (seen && seen.has(issueKey)) continue;
    if (seen) seen.add(issueKey);
    dictionaryState.warnings.push({ ...i, issueKey });
    added += 1;
  }
  return added;
}
