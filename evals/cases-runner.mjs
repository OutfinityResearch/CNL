import { readFile } from "fs/promises";
import { parseProgram } from "../src/parser/grammar.mjs";
import { compileProgram } from "../src/compiler/compile.mjs";

function parseValue(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function parseCases(text) {
  const cases = [];
  let current = null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("- ")) {
      if (current) cases.push(current);
      current = {};
      const entry = trimmed.slice(2).trim();
      if (entry) {
        const [key, ...rest] = entry.split(":");
        current[key.trim()] = parseValue(rest.join(":").trim());
      }
      continue;
    }
    if (!current) continue;
    const [key, ...rest] = trimmed.split(":");
    current[key.trim()] = parseValue(rest.join(":").trim());
  }

  if (current) cases.push(current);
  return cases;
}

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

function formatExpected(expectation) {
  if (typeof expectation === "string") return expectation;
  try {
    return JSON.stringify(expectation);
  } catch {
    return String(expectation);
  }
}

export async function runCaseSuite({ fileUrl, title, evaluate, compare, formatOutput }) {
  const raw = await readFile(fileUrl, "utf8");
  const cases = parseCases(raw);
  const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    reset: "\x1b[0m",
  };

  let passed = 0;
  let failed = 0;
  const rows = [];

  for (const testCase of cases) {
    const input = testCase.input ?? "";
    const preview = summarizeInput(input);
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

      if (evaluate) {
        let output = null;
        try {
          output = await evaluate({ input, testCase });
        } catch (error) {
          failed += 1;
          const message = error?.message ?? "evaluation error";
          rows.push({
            status: "FAIL",
            purpose: testCase.purpose,
            case: preview,
            note: `evaluation error: ${message}`,
          });
          continue;
        }

        if (output && output.error) {
          failed += 1;
          rows.push({
            status: "FAIL",
            purpose: testCase.purpose,
            case: preview,
            note: output.error,
          });
          continue;
        }

      const hasExpectation =
        testCase.expect !== undefined && testCase.expect !== null && !String(testCase.expect).includes("placeholder");
      if (hasExpectation) {
        const ok = compare ? compare(testCase, output) : String(output) === String(testCase.expect);
        if (!ok) {
          failed += 1;
          rows.push({
            status: "FAIL",
            purpose: testCase.purpose,
            case: preview,
            note: `expected ${formatExpected(testCase.expect)} got ${formatOutput ? formatOutput(output) : String(output)}`,
          });
          continue;
        }
      }

      passed += 1;
      rows.push({
        status: "PASS",
        purpose: testCase.purpose,
        case: preview,
        note: formatOutput ? formatOutput(output) : "",
      });
      continue;
    }

    let ast = null;
    try {
      ast = parseProgram(input);
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

    passed += 1;
    const note = testCase.expect && !String(testCase.expect).includes("placeholder")
      ? "pending expectation"
      : "";
    rows.push({
      status: "PASS",
      purpose: testCase.purpose,
      case: preview,
      note,
    });
  }

  renderTable(`${title} suite`, [
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
}
