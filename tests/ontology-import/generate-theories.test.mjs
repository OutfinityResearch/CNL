import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateAllTheories } from "../../tools/ontology-import/generate-theories.mjs";

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

test("generateAllTheories scans ontologies/ and writes outputs", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cnl-ontology-gen-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const ontologiesDir = path.join(root, "ontologies");
  const outRoot = path.join(root, "theories", "ontologies");

  const folder = path.join(ontologiesDir, "mini");
  write(
    path.join(folder, "mini.ttl"),
    `@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:A a owl:Class .
ex:B a owl:Class .
ex:A rdfs:subClassOf ex:B .
ex:relatedTo a owl:ObjectProperty ; rdf:type owl:SymmetricProperty .
`
  );

  const result = generateAllTheories({
    cwd: process.cwd(),
    ontologiesDir,
    defaultOutRoot: outRoot,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 1);

  const produced = result.results[0].files;
  assert.ok(fs.existsSync(produced.dictGeneratedPath));
  assert.ok(fs.existsSync(produced.rulesGeneratedPath));
  assert.ok(fs.existsSync(produced.dictExtraPath));
  assert.ok(fs.existsSync(produced.rulesExtraPath));

  const dictText = fs.readFileSync(produced.dictGeneratedPath, "utf8");
  assert.ok(dictText.includes('"a" is a type.'));
  assert.ok(dictText.includes('"a" is a subtype of "b".'));

  const rulesText = fs.readFileSync(produced.rulesGeneratedPath, "utf8");
  assert.ok(rulesText.includes("Rule: If X is related to Y, then Y is related to X."));
});
