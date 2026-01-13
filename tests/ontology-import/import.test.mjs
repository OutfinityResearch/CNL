import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runImport } from "../../tools/ontology-import/import.mjs";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("ontology import writes generated files and dedupes extras", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cnl-ontology-import-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outDir = path.join(root, "mini");

  const result = runImport({
    in: ["tools/ontology-import/fixtures/mini.ttl"],
    out: outDir,
    context: "MiniOntology",
  });

  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(result.files.dictGeneratedPath));
  assert.ok(fs.existsSync(result.files.rulesGeneratedPath));
  assert.ok(fs.existsSync(result.files.dictExtraPath));
  assert.ok(fs.existsSync(result.files.rulesExtraPath));

  const dict = read(result.files.dictGeneratedPath);
  assert.ok(dict.includes('--- CONTEXT: BaseDictionary ---'));
  assert.ok(dict.includes('"person" is a type.'));
  assert.ok(dict.includes('"believes" is a "binary predicate".'));
  assert.ok(dict.includes('the domain of "believes" is "agent".'));

  const rules = read(result.files.rulesGeneratedPath);
  assert.ok(rules.includes('--- CONTEXT: MiniOntology ---'));
  assert.ok(rules.includes("Rule: If X believes in Y and Y believes in Z, then X believes in Z."));
  assert.ok(rules.includes("Rule: If X is prior to Y, then Y is subsequent to X."));

  // Add a duplicate statement to dictionary extra and ensure the next import removes it.
  fs.appendFileSync(result.files.dictExtraPath, '\n"person" is a type.\n', "utf8");
  const result2 = runImport({
    in: ["tools/ontology-import/fixtures/mini.ttl"],
    out: outDir,
    context: "MiniOntology",
  });
  assert.ok(result2.removedDuplicates.dictionaryExtra >= 1);
  const dictExtra = read(result2.files.dictExtraPath);
  assert.ok(!dictExtra.includes('"person" is a type.'));
});
