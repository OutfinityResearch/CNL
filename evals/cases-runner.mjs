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

export async function runCaseSuite({ fileUrl, title }) {
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

  for (const testCase of cases) {
    const input = testCase.input ?? "";
    const preview = summarizeInput(input);
    const purpose = testCase.purpose ? ` purpose: ${testCase.purpose}` : "";

    if (!testCase.purpose) {
      failed += 1;
      console.log(`${colors.red}FAIL${colors.reset} ${title} - missing purpose: "${preview}"`);
      continue;
    }

    let ast = null;
    try {
      ast = parseProgram(input);
    } catch (error) {
      failed += 1;
      const message = error?.message ?? "parse error";
      console.log(`${colors.red}FAIL${colors.reset} ${title} -${purpose} - parse error: ${message}`);
      continue;
    }

    const state = compileProgram(ast);
    if (state.errors.length > 0) {
      failed += 1;
      console.log(`${colors.red}FAIL${colors.reset} ${title} -${purpose} - compiler errors: "${preview}"`);
      continue;
    }

    passed += 1;
    const note = testCase.expect && !String(testCase.expect).includes("placeholder")
      ? " (pending expectation)"
      : "";
    console.log(`${colors.green}PASS${colors.reset} ${title} -${purpose} - "${preview}"${note}`);
  }

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}
