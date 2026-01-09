import { readFile } from "fs/promises";
import { parseProgram } from "../src/parser/grammar.mjs";
import { compileProgram } from "../src/compiler/compile.mjs";

const evalPath = new URL("./reasoning/compiler.v1.json", import.meta.url);
const raw = await readFile(evalPath, "utf8");
const cases = JSON.parse(raw);

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
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

function padCell(text, width) {
  return String(text ?? "").padEnd(width);
}

function renderTable(title, columns, rows, colors) {
  const widths = columns.map((column) => column.label.length);
  for (const row of rows) {
    for (let i = 0; i < columns.length; i += 1) {
      const key = columns[i].key;
      const value = row[key] ?? "";
      widths[i] = Math.max(widths[i], String(value).length);
    }
  }

  if (title) console.log(`\n${title}`);
  const header = columns.map((column, i) => padCell(column.label, widths[i])).join(" | ");
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");
  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const line = columns.map((column, i) => {
      const value = String(row[column.key] ?? "");
      if (column.key === "status") {
        const color = value === "PASS" ? colors.green : value === "FAIL" ? colors.red : colors.yellow;
        return `${color}${padCell(value, widths[i])}${colors.reset}`;
      }
      return padCell(value, widths[i]);
    }).join(" | ");
    console.log(line);
  }
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

function formatSummary(summary) {
  if (!summary) return "";
  return `U${summary.unaryFacts} B${summary.binaryFacts} N${summary.numericFacts} A${summary.entityAttrFacts}`;
}

let passed = 0;
let failed = 0;
const rows = [];

for (const testCase of cases) {
  const preview = summarizeInput(testCase.input);
  if (!testCase.purpose) {
    failed += 1;
    rows.push({
      status: "FAIL",
      purpose: "(missing)",
      case: preview,
      note: "missing purpose",
    });
    continue;
  }
  let ast = null;
  try {
    ast = parseProgram(testCase.input);
  } catch (error) {
    failed += 1;
    const message = error?.message ?? "parse error";
    rows.push({
      status: "FAIL",
      purpose: testCase.purpose,
      case: preview,
      note: `parse error: ${message}`,
    });
    continue;
  }

  const state = compileProgram(ast);
  if (state.errors.length > 0) {
    failed += 1;
    rows.push({
      status: "FAIL",
      purpose: testCase.purpose,
      case: preview,
      note: `compiler errors (${state.errors.length})`,
    });
    continue;
  }
  const actual = summarize(state.kb.kb);
  const expected = testCase.expected;
  if (!expected) {
    failed += 1;
    rows.push({
      status: "FAIL",
      purpose: testCase.purpose,
      case: preview,
      note: "missing expected summary",
    });
    continue;
  }
  const match = Object.keys(expected).every((key) => expected[key] === actual[key]);
  if (!match) {
    failed += 1;
    rows.push({
      status: "FAIL",
      purpose: testCase.purpose,
      case: preview,
      note: `summary mismatch: exp ${formatSummary(expected)} got ${formatSummary(actual)}`,
    });
    continue;
  }
  passed += 1;
  rows.push({
    status: "PASS",
    purpose: testCase.purpose,
    case: preview,
    note: `summary ${formatSummary(actual)}`,
  });
}

renderTable("Compiler suite", [
  { key: "status", label: "Status" },
  { key: "purpose", label: "Purpose" },
  { key: "case", label: "Case" },
  { key: "note", label: "Note" },
], rows, colors);

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
