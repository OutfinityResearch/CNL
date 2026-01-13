import fs from "node:fs";
import path from "node:path";

function normalizeStatementKey(line) {
  return String(line || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

function isStatementLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("--- CONTEXT:")) return false;
  return trimmed.endsWith(".");
}

export function writeGeneratedFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

export function ensureExtraFile(filePath, contextLine, headerLines = []) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) return;
  const lines = [];
  lines.push(...headerLines);
  if (headerLines.length) lines.push("");
  lines.push(contextLine);
  lines.push("");
  lines.push("// Add manual statements here. Re-running the ontology importer will remove duplicates.");
  lines.push("");
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function dedupeExtraFile(filePath, generatedKeys) {
  if (!fs.existsSync(filePath)) return { removed: 0 };
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let removed = 0;

  for (const line of lines) {
    if (isStatementLine(line)) {
      const key = normalizeStatementKey(line);
      if (generatedKeys.has(key)) {
        removed += 1;
        continue;
      }
    }
    out.push(line);
  }

  fs.writeFileSync(filePath, out.join("\n").replace(/\n+$/, "\n"), "utf8");
  return { removed };
}

