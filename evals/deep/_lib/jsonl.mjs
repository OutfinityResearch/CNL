import fs from "node:fs";

export function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    out.push(JSON.parse(line));
  }
  return out;
}

export function writeJsonl(filePath, items) {
  const lines = (items || []).map((it) => JSON.stringify(it));
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

