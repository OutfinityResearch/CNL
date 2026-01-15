import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_BASE_DICTIONARY_FILES,
  DEFAULT_BASE_THEORY_FILES,
} from "./base-defaults.mjs";

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error?.message ? `: ${error.message}` : "";
    throw new Error(`Failed to read theory file "${filePath}"${message}`, { cause: error });
  }
}

/**
 * Loads BaseDictionary source files from disk.
 * @param {string[]} paths
 * @returns {{path:string,text:string}[]}
 */
export function loadBaseDictionary(paths) {
  return paths.map((path) => ({ path, text: readTextFile(path) }));
}

/**
 * Loads base theory CNL files from disk.
 * @param {string[]} paths
 * @returns {{path:string,text:string}[]}
 */
export function loadBaseTheories(paths) {
  return paths.map((path) => ({ path, text: readTextFile(path) }));
}

/**
 * Loads the default base bundle (dictionary + theories) as configured by `src/theories/base-defaults.mjs`.
 * @param {object} [options]
 * @param {string} [options.rootDir=process.cwd()]
 * @returns {{dictionary:{path:string,text:string}[],theories:{path:string,text:string}[]}}
 */
export function loadDefaultBaseBundle(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const dictionaryPaths = DEFAULT_BASE_DICTIONARY_FILES.map((rel) => path.resolve(rootDir, rel));
  const theoryPaths = DEFAULT_BASE_THEORY_FILES.map((rel) => path.resolve(rootDir, rel));
  return {
    dictionary: loadBaseDictionary(dictionaryPaths),
    theories: loadBaseTheories(theoryPaths),
  };
}
