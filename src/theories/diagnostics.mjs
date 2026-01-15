import fs from "node:fs";
import path from "node:path";
import { ConceptKind } from "../ids/interners.mjs";
import { displayEntityKey } from "../utils/display-keys.mjs";

/**
 * Shared theory diagnostics and preprocessor expansion logic.
 *
 * Used by:
 * - `tools/check-theories.mjs` (static checking)
 * - `CNLSession.learnText()` (load-time renames + issues)
 * - KB Explorer server routes (issues, dedupe, warnings)
 */
const LOAD_DIRECTIVE_RE = /^\s*Load\s*:\s*"([^"]+)"\s*\.\s*$/i;
const RENAME_TYPE_DIRECTIVE_RE = /^\s*RenameType\s*:\s*"([^"]+)"\s*->\s*"([^"]+)"\s*\.\s*$/i;
const RENAME_PREDICATE_DIRECTIVE_RE = /^\s*RenamePredicate\s*:\s*"([^"]+)"\s*->\s*"([^"]+)"\s*\.\s*$/i;

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error?.message ? `: ${error.message}` : "";
    throw new Error(`Failed to read theory file "${filePath}"${message}`, { cause: error });
  }
}

function issue(kind, severity, message, extra = {}) {
  return {
    kind,
    severity,
    message,
    ...(extra.key ? { key: extra.key } : {}),
    ...(extra.details ? { details: extra.details } : {}),
    ...(extra.file ? { file: extra.file } : {}),
    ...(Number.isInteger(extra.line) ? { line: extra.line } : {}),
    ...(extra.hint ? { hint: extra.hint } : {}),
  };
}

function lookupKey(idStore, kind, denseId) {
  if (!idStore || !Number.isInteger(denseId)) return null;
  const conceptId = idStore.getConceptualId(kind, denseId);
  return conceptId ? idStore.lookupKey(conceptId) : null;
}

function unaryPairsByBase(idStore) {
  const pairs = new Map(); // base -> { posId, negId }
  const n = idStore?.size?.(ConceptKind.UnaryPredicate) ?? 0;
  for (let id = 0; id < n; id += 1) {
    const key = lookupKey(idStore, ConceptKind.UnaryPredicate, id);
    if (!key || !key.startsWith("U:")) continue;
    if (key.startsWith("U:not|")) {
      const base = key.slice("U:not|".length);
      if (!pairs.has(base)) pairs.set(base, { posId: null, negId: null });
      pairs.get(base).negId = id;
      continue;
    }
    const base = key.slice("U:".length);
    if (!pairs.has(base)) pairs.set(base, { posId: null, negId: null });
    pairs.get(base).posId = id;
  }
  return pairs;
}

function predPairsByBase(idStore) {
  const pairs = new Map(); // baseRest -> { posIds:Set<number>, negIds:Set<number> }
  const n = idStore?.size?.(ConceptKind.Predicate) ?? 0;
  for (let id = 0; id < n; id += 1) {
    const key = lookupKey(idStore, ConceptKind.Predicate, id);
    if (!key || !key.startsWith("P:")) continue;
    const rest = key.startsWith("P:not|") ? key.slice("P:not|".length) : key.slice("P:".length);
    const normalizedRest = normalizePredicateRest(rest);
    if (!pairs.has(normalizedRest)) pairs.set(normalizedRest, { posIds: new Set(), negIds: new Set() });
    const entry = pairs.get(normalizedRest);
    if (key.startsWith("P:not|")) {
      entry.negIds.add(id);
      continue;
    }
    entry.posIds.add(id);
  }
  return pairs;
}

function normalizeVerbLike(verb) {
  const v = String(verb || "").trim().toLowerCase();
  if (!v) return v;
  if (v.endsWith("ies") && v.length > 3) return `${v.slice(0, -3)}y`;
  if (v.endsWith("oes") && v.length > 3) return v.slice(0, -2); // "goes" -> "go"
  if (v.endsWith("ches") || v.endsWith("shes") || v.endsWith("xes")) return v.slice(0, -2); // drop "es"
  if (v.endsWith("sses") || v.endsWith("zzes")) return v.slice(0, -2); // "kisses" -> "kiss"
  if (v.endsWith("s") && !v.endsWith("ss") && v.length > 1) return v.slice(0, -1);
  return v;
}

function normalizePredicateRest(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("passive:")) return raw; // already stable
  const parts = raw.split("|").filter((p) => p.length > 0);
  if (parts.length === 0) return raw;
  const hasAux = parts[0].startsWith("aux:");
  const verbIndex = hasAux ? 1 : 0;
  if (verbIndex >= parts.length) return raw;
  parts[verbIndex] = normalizeVerbLike(parts[verbIndex]);
  return parts.join("|");
}

export function analyzeContradictoryAssertions(state, options = {}) {
  const out = [];
  const idStore = state?.idStore;
  const rawKb = state?.kb?.kb;
  if (!idStore || !rawKb) return out;

  // Unary contradictions: E is U:base and U:not|base.
  const unaryPairs = unaryPairsByBase(idStore);
  for (const [base, ids] of unaryPairs.entries()) {
    const posId = ids.posId;
    const negId = ids.negId;
    if (!Number.isInteger(posId) || !Number.isInteger(negId)) continue;
    const pos = rawKb.unaryIndex?.[posId];
    const neg = rawKb.unaryIndex?.[negId];
    if (!pos || !neg) continue;
    const both = pos.and(neg);
    if (both.isEmpty()) continue;

    both.iterateSetBits((entityId) => {
      const entKey = lookupKey(idStore, ConceptKind.Entity, entityId);
      const ent = displayEntityKey(entKey) || `Entity_${entityId}`;
      const key = `${ent}|${base}`;
      out.push(
        issue(
          "ContradictoryAssertion",
          "error",
          `Contradiction: '${ent}' is both '${base}' and 'not ${base}'.`,
          {
            key,
            details: {
              entity: ent,
              entityKey: entKey,
              positiveUnaryKey: `U:${base}`,
              negativeUnaryKey: `U:not|${base}`,
            },
            hint: "Remove one of the explicit assertions or adjust the theory to avoid explicit contradictions.",
          },
        ),
      );
    });
  }

  // Binary contradictions: (S, P:base, O) and (S, P:not|base, O).
  const predPairs = predPairsByBase(idStore);
  const seenBinary = new Set();
  for (const [baseRest, ids] of predPairs.entries()) {
    const posIds = [...(ids.posIds ?? [])];
    const negIds = [...(ids.negIds ?? [])];
    if (posIds.length === 0 || negIds.length === 0) continue;

    for (const posId of posIds) {
      for (const negId of negIds) {
        if (!Number.isInteger(posId) || !Number.isInteger(negId)) continue;
        const pos = rawKb.relations?.[posId];
        const neg = rawKb.relations?.[negId];
        if (!pos || !neg) continue;

        const rows = Math.min(pos.rows?.length ?? 0, neg.rows?.length ?? 0);
        for (let s = 0; s < rows; s += 1) {
          const posRow = pos.rows[s];
          const negRow = neg.rows[s];
          if (!posRow || !negRow) continue;
          const both = posRow.and(negRow);
          if (both.isEmpty()) continue;

          const subjKey = lookupKey(idStore, ConceptKind.Entity, s);
          const subj = displayEntityKey(subjKey) || `Entity_${s}`;
          both.iterateSetBits((o) => {
            const objKey = lookupKey(idStore, ConceptKind.Entity, o);
            const obj = displayEntityKey(objKey) || `Entity_${o}`;
            const k = `${subj}|${baseRest}|${obj}|${posId}|${negId}`;
            if (seenBinary.has(k)) return;
            seenBinary.add(k);
            out.push(
              issue(
                "ContradictoryAssertion",
                "error",
                `Contradiction: '${subj}' both '${baseRest.split("|").join(" ")}' and 'does not ${baseRest.split("|").join(" ")}' '${obj}'.`,
                {
                  key: `${subj}|${baseRest}|${obj}`,
                  details: {
                    subject: subj,
                    subjectKey: subjKey,
                    object: obj,
                    objectKey: objKey,
                    positivePredicateKey: lookupKey(idStore, ConceptKind.Predicate, posId),
                    negativePredicateKey: lookupKey(idStore, ConceptKind.Predicate, negId),
                  },
                  hint: "Remove one of the explicit assertions or adjust the theory to avoid explicit contradictions.",
                },
              ),
            );
          });
        }
      }
    }
  }

  return out;
}

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

export function hasPreprocessorDirectives(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  return lines.some(
    (line) => LOAD_DIRECTIVE_RE.test(line) || RENAME_TYPE_DIRECTIVE_RE.test(line) || RENAME_PREDICATE_DIRECTIVE_RE.test(line),
  );
}

export function stripPreprocessorDirectives(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  return (
    lines
      .map((line) => {
        if (LOAD_DIRECTIVE_RE.test(line)) return "// (Load removed)";
        if (RENAME_TYPE_DIRECTIVE_RE.test(line) || RENAME_PREDICATE_DIRECTIVE_RE.test(line)) return "// (Rename removed)";
        return line;
      })
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

    const loaded = readTextFile(abs);
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
  const entryText = readTextFile(entryAbs);
  const files = new Map();
  files.set(entryAbs, {
    absPath: entryAbs,
    relPath: path.relative(rootDir, entryAbs).replace(/\\/g, "/"),
    text: entryText,
  });

  const visited = new Set([entryAbs]);
  const expanded = expandTextToSegments(entryText, { rootDir, source: entryAbs, visited, files });

  const segments = expanded.segments
    .map((s) => ({ path: s.path, text: stripPreprocessorDirectives(s.text) }))
    .filter((s) => s.text.trim().length > 0);

  return {
    entryAbs,
    segments,
    files: [...expanded.files.values()],
  };
}

export function expandTheoryText(text, options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const source = options.source || null;
  const files = new Map();

  if (source) {
    const abs = path.resolve(rootDir, source);
    files.set(abs, {
      absPath: abs,
      relPath: path.relative(rootDir, abs).replace(/\\/g, "/"),
      text,
    });
  } else {
    files.set(null, { absPath: null, relPath: "(inline)", text });
  }

  const visited = new Set();
  if (source) {
    visited.add(path.resolve(rootDir, source));
  }

  const expanded = expandTextToSegments(text, { rootDir, source: source ? path.resolve(rootDir, source) : null, visited, files });

  const segments = expanded.segments
    .map((s) => ({ path: s.path, text: stripPreprocessorDirectives(s.text) }))
    .filter((s) => s.text.trim().length > 0);

  return { segments, files: [...expanded.files.values()] };
}

function fileId(file) {
  return file?.relPath || file?.absPath || "unknown";
}

export function extractLoadTimeRenames(files) {
  const typeKeyRenames = Object.create(null);
  const predicateKeyRenames = Object.create(null);
  const issues = [];

  const seen = new Map(); // `${kind}:${from}` -> { to, files: Set }

  for (const f of files || []) {
    const id = fileId(f);
    const lines = String(f.text || "").replace(/\r\n/g, "\n").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("//")) continue;
      if (line.startsWith("--- CONTEXT:")) continue;

      let match = line.match(RENAME_TYPE_DIRECTIVE_RE);
      if (match) {
        const from = match[1].trim();
        const to = match[2].trim();
        const key = `type:${from}`;
        if (!seen.has(key)) {
          seen.set(key, { to, files: new Set([id]) });
          typeKeyRenames[from] = to;
        } else {
          const prior = seen.get(key);
          prior.files.add(id);
          if (prior.to !== to) {
            issues.push({
              kind: "LoadTimeRenameConflict",
              severity: "error",
              key: from,
              message: `Conflicting RenameType directives for '${from}': '${prior.to}' vs '${to}'.`,
              details: { from, toA: prior.to, toB: to, files: [...prior.files].sort() },
              file: id,
              line: index + 1,
              hint: "Make RenameType directives consistent across the loaded bundle.",
            });
          }
        }
        continue;
      }

      match = line.match(RENAME_PREDICATE_DIRECTIVE_RE);
      if (match) {
        const from = match[1].trim();
        const to = match[2].trim();
        const key = `pred:${from}`;
        if (!seen.has(key)) {
          seen.set(key, { to, files: new Set([id]) });
          predicateKeyRenames[from] = to;
        } else {
          const prior = seen.get(key);
          prior.files.add(id);
          if (prior.to !== to) {
            issues.push({
              kind: "LoadTimeRenameConflict",
              severity: "error",
              key: from,
              message: `Conflicting RenamePredicate directives for '${from}': '${prior.to}' vs '${to}'.`,
              details: { from, toA: prior.to, toB: to, files: [...prior.files].sort() },
              file: id,
              line: index + 1,
              hint: "Make RenamePredicate directives consistent across the loaded bundle.",
            });
          }
        }
      }
    }
  }

  return { typeKeyRenames, predicateKeyRenames, issues };
}

export function analyzeCrossOntologyDuplicates(files, options = {}) {
  const includeBenign = options.includeBenign ?? false;
  const renames = options.renames || null;
  const typeKeyRenames = renames?.typeKeyRenames || null;
  const predicateKeyRenames = renames?.predicateKeyRenames || null;

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

  function maybeRename(key, map) {
    if (!map) return key;
    const normalized = String(key || "").trim();
    if (!normalized) return key;
    return map[normalized] || key;
  }

  for (const f of files || []) {
    const id = fileId(f);
    const lines = String(f.text || "").replace(/\r\n/g, "\n").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("//")) continue;
      if (line.startsWith("--- CONTEXT:")) continue;
      if (LOAD_DIRECTIVE_RE.test(line)) continue;
      if (RENAME_TYPE_DIRECTIVE_RE.test(line) || RENAME_PREDICATE_DIRECTIVE_RE.test(line)) continue;

      let match = line.match(typePattern);
      if (match) {
        const key = maybeRename(match[1], typeKeyRenames);
        ensureSet(typeDeclaredIn, key).add(id);
        continue;
      }

      match = line.match(binaryPredicatePattern);
      if (match) {
        const key = maybeRename(match[1], predicateKeyRenames);
        ensureSet(predicateDeclaredIn, key).add(id);
        continue;
      }

      match = line.match(subtypePattern);
      if (match) {
        const child = maybeRename(match[1], typeKeyRenames);
        const parent = maybeRename(match[2], typeKeyRenames);
        const byFile = ensureNested(subtypeParentsByFile, child);
        if (!byFile.has(id)) byFile.set(id, new Set());
        byFile.get(id).add(parent);
        continue;
      }

      match = line.match(domainPattern);
      if (match) {
        const pred = maybeRename(match[1], predicateKeyRenames);
        const type = maybeRename(match[2], typeKeyRenames);
        const byFile = ensureNested(domainByFile, pred);
        if (!byFile.has(id)) byFile.set(id, new Set());
        byFile.get(id).add(type);
        continue;
      }

      match = line.match(rangePattern);
      if (match) {
        const pred = maybeRename(match[1], predicateKeyRenames);
        const type = maybeRename(match[2], typeKeyRenames);
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
