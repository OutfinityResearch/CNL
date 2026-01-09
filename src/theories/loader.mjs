import fs from "node:fs";

export function loadBaseDictionary(paths) {
  return paths.map((path) => ({ path, text: fs.readFileSync(path, "utf8") }));
}

export function loadBaseTheories(paths) {
  return paths.map((path) => ({ path, text: fs.readFileSync(path, "utf8") }));
}
