import { readFile, readdir } from "fs/promises";
import { parseProgram } from "../src/parser/grammar.mjs";

function isObject(value) {
  return value !== null && typeof value === "object";
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function matchExpected(actual, expected) {
  if (expected === actual) return true;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i += 1) {
      if (!matchExpected(actual[i], expected[i])) return false;
    }
    return true;
  }
  if (isObject(expected)) {
    if (!isObject(actual)) return false;
    for (const key of Object.keys(expected)) {
      if (!matchExpected(actual[key], expected[key])) return false;
    }
    return true;
  }
  return false;
}

function normalizeError(err) {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }
  return {
    code: err.code,
    name: err.name,
    message: err.message,
    severity: err.severity,
    primaryToken: err.primaryToken,
    hint: err.hint,
    offendingField: err.offendingField,
  };
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

function formatErrorCode(expectedError, actualError) {
  const expected = expectedError?.code ?? "";
  const actual = actualError?.code ?? "";
  if (expected && actual && expected !== actual) {
    return `${expected} -> ${actual}`;
  }
  return expected || actual || "";
}

const evalDir = new URL("./parsing/", import.meta.url);
const files = (await readdir(evalDir)).filter((file) => file.endsWith(".json")).sort();
const cases = [];

for (const file of files) {
  const fileUrl = new URL(file, evalDir);
  const raw = await readFile(fileUrl, "utf8");
  const parsed = JSON.parse(raw);
  for (const entry of parsed) {
    cases.push({ ...entry, _file: file });
  }
}

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

let passed = 0;
let failed = 0;
const failures = [];

for (const testCase of cases) {
  const { id, valid, input, expected, expectedError, _file } = testCase;
  const preview = summarizeInput(input);
  const label = valid ? "valid" : "invalid";
  const expectedCode = expectedError?.code ?? "";
  try {
    const result = parseProgram(input);
    if (!valid) {
      failed += 1;
      failures.push({ id, reason: "Expected error, got success", file: _file });
      console.log(`${colors.red}FAIL${colors.reset} ${id} (${_file}) [${label}] - expected ${expectedCode}: \"${preview}\"`);
      continue;
    }
    if (!deepEqual(result, expected)) {
      failed += 1;
      failures.push({ id, reason: "AST mismatch", expected, actual: result, file: _file });
      console.log(`${colors.red}FAIL${colors.reset} ${id} (${_file}) [${label}] - AST mismatch: \"${preview}\"`);
      continue;
    }
    passed += 1;
    console.log(`${colors.green}PASS${colors.reset} ${id} (${_file}) [${label}] - \"${preview}\"`);
  } catch (err) {
    if (valid) {
      failed += 1;
      const actualError = normalizeError(err);
      failures.push({ id, reason: "Unexpected error", error: actualError, file: _file });
      const codeHint = formatErrorCode(null, actualError);
      const nameHint = actualError?.name ? `/${actualError.name}` : "";
      console.log(
        `${colors.red}FAIL${colors.reset} ${id} (${_file}) [${label}] - unexpected ${codeHint}${nameHint}: \"${preview}\"`
      );
      continue;
    }
    const actualError = normalizeError(err);
    if (!matchExpected(actualError, expectedError)) {
      failed += 1;
      failures.push({
        id,
        reason: "Error mismatch",
        expected: expectedError,
        actual: actualError,
        file: _file,
      });
      const codeHint = formatErrorCode(expectedError, actualError);
      console.log(`${colors.red}FAIL${colors.reset} ${id} (${_file}) [${label}] - error mismatch ${codeHint}: \"${preview}\"`);
      continue;
    }
    passed += 1;
    console.log(`${colors.green}PASS${colors.reset} ${id} (${_file}) [${label} ${expectedCode}] - \"${preview}\"`);
  }
}

if (failures.length) {
  console.error(`${colors.red}Parsing evaluation failed:${colors.reset}`);
  for (const failure of failures) {
    console.error(`- ${failure.id} (${failure.file}): ${failure.reason}`);
  }
} else {
  console.log(`${colors.green}Parsing evaluation passed.${colors.reset}`);
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
