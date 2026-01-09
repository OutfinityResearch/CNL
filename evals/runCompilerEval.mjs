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
  if (state.errors.length > 0) {
    failed += 1;
    console.log(`${colors.red}FAIL${colors.reset} ${testCase.id} - compiler errors`);
    continue;
  }
  const actual = summarize(state.kb.kb);
  const expected = testCase.expected;
  const match = Object.keys(expected).every((key) => expected[key] === actual[key]);
  if (!match) {
    failed += 1;
    console.log(`${colors.red}FAIL${colors.reset} ${testCase.id} - summary mismatch`);
    continue;
  }
  passed += 1;
  console.log(`${colors.green}PASS${colors.reset} ${testCase.id}`);
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
