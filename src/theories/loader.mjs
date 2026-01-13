import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_BASE_DICTIONARY_FILES,
  DEFAULT_BASE_THEORY_FILES,
} from "./base-defaults.mjs";

export function loadBaseDictionary(paths) {
  return paths.map((path) => ({ path, text: fs.readFileSync(path, "utf8") }));
}

export function loadBaseTheories(paths) {
  return paths.map((path) => ({ path, text: fs.readFileSync(path, "utf8") }));
}

export function loadDefaultBaseBundle(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const dictionaryPaths = DEFAULT_BASE_DICTIONARY_FILES.map((rel) => path.resolve(rootDir, rel));
  const theoryPaths = DEFAULT_BASE_THEORY_FILES.map((rel) => path.resolve(rootDir, rel));
  return {
    dictionary: loadBaseDictionary(dictionaryPaths),
    theories: loadBaseTheories(theoryPaths),
  };
}
