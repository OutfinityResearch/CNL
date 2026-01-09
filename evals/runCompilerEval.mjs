import { readFile } from "fs/promises";
import { parseProgram } from "../src/parser/grammar.mjs";
import { compileProgram } from "../src/compiler/compile.mjs";

const evalPath = new URL("./reasoning/compiler.v1.json", import.meta.url);
const raw = await readFile(evalPath, "utf8");
const cases = JSON.parse(raw);

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

function summarizeInput(input) {
  const normalized = input.replace(/\r\n/g, "\n").trimEnd();
  const lines = normalized.split("\n");
  if (lines.length === 1) {
    const line = lines[0].trim();
    if (line.length <= 90) return line;
    return line.slice(0, 87) + "...";
  }
  const firstLine = lines[0].trim();
  if (!firstLine) return "...";
  return firstLine + " ...";
}

function summarize(kbState) {
  let unaryFacts = 0;
  for (const set of kbState.unaryIndex) {
    unaryFacts += set.popcount();
  }
  let binaryFacts = 0;
  for (const rel of kbState.relations) {
    for (const row of rel.rows) {
      binaryFacts += row.popcount();
    }
  }
  let numericFacts = 0;
  for (const index of kbState.numericIndex) {
    numericFacts += index.hasValue.popcount();
  }
  let entityAttrFacts = 0;
  for (const index of kbState.entAttrIndex) {
    for (const row of index.values) {
      entityAttrFacts += row.popcount();
    }
  }
  return { unaryFacts, binaryFacts, numericFacts, entityAttrFacts };
}

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  const ast = parseProgram(testCase.input);
  const state = compileProgram(ast);
  const preview = summarizeInput(testCase.input);
  const purpose = testCase.purpose ? ` purpose: ${testCase.purpose}` : "";
  if (state.errors.length > 0) {
    failed += 1;
    console.log(`${colors.red}FAIL${colors.reset} ${testCase.id} -${purpose} - compiler errors: \"${preview}\"`);
    continue;
  }
  const actual = summarize(state.kb.kb);
  const expected = testCase.expected;
  const match = Object.keys(expected).every((key) => expected[key] === actual[key]);
  if (!match) {
    failed += 1;
    console.log(`${colors.red}FAIL${colors.reset} ${testCase.id} -${purpose} - summary mismatch: \"${preview}\"`);
    continue;
  }
  passed += 1;
  console.log(`${colors.green}PASS${colors.reset} ${testCase.id} -${purpose} - \"${preview}\"`);
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
