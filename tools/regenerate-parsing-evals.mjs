import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseProgram } from "../src/parser/grammar.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parsingDir = path.join(__dirname, "..", "evals", "parsing");

function isObject(value) {
  return value !== null && typeof value === "object";
}

function normalizeEntry(entry) {
  if (!isObject(entry)) return entry;
  if (entry.valid === true && typeof entry.input === "string") {
    return { ...entry, expected: parseProgram(entry.input) };
  }
  return entry;
}

async function main() {
  const files = (await readdir(parsingDir)).filter((name) => name.endsWith(".json")).sort();
  let updated = 0;

  for (const name of files) {
    const filePath = path.join(parsingDir, name);
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) continue;
    const next = data.map(normalizeEntry);
    await writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    updated += 1;
  }

  console.log(`Updated ${updated} parsing eval file(s) in ${parsingDir}`);
}

await main();

