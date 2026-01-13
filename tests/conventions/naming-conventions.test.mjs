import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_SUITE } from "../../evals/kbDemo/suite.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..");

function walkFiles(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (!predicate || predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

function findNamingViolations(text) {
  const violations = [];
  const rules = [
    {
      id: "uppercase-after-is-a",
      re: /\bis\s+(?:a|an)\s+([A-Z][A-Za-z0-9_-]*)\b/g,
      message: (match) =>
        `Concept after "is a/an" must be lowercase/hyphenated, got "${match[1]}".`,
    },
    {
      id: "uppercase-after-every",
      re: /\bEvery\s+([A-Z][A-Za-z0-9_-]*)\b/g,
      message: (match) =>
        `Concept after "Every" must be lowercase/hyphenated, got "${match[1]}".`,
    },
    {
      id: "uppercase-after-return-every",
      re: /\bReturn\s+(?:the\s+name\s+of\s+)?every\s+([A-Z][A-Za-z0-9_-]*)\b/g,
      message: (match) =>
        `Concept after "Return ... every" must be lowercase/hyphenated, got "${match[1]}".`,
    },
    {
      id: "underscore-concept",
      re: /\bis\s+(?:a|an)\s+([a-z][A-Za-z0-9_-]*_[A-Za-z0-9_-]*)\b/g,
      message: (match) =>
        `Compound concept should use "-" instead of "_", got "${match[1]}".`,
    },
    {
      id: "the-prefix-in-name",
      re: /\bthe_[A-Za-z0-9_-]+\b/g,
      message: (match) =>
        `Name should not encode articles (avoid "the_*"), got "${match[0]}".`,
    },
  ];

  for (const rule of rules) {
    let match;
    while ((match = rule.re.exec(text))) {
      violations.push({ rule: rule.id, index: match.index, detail: rule.message(match) });
    }
  }

  return violations;
}

function checkInputs(inputs, label) {
  const failures = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const input = String(inputs[i] ?? "");
    const violations = findNamingViolations(input);
    violations.forEach((violation) => {
      failures.push(`${label}[${i}]: ${violation.detail}`);
    });
  }
  return failures;
}

function loadCasesInputs(casesPath) {
  const content = fs.readFileSync(casesPath, "utf8");
  const inputs = [];
  const re = /^\s*-\s*input:\s*(\"(?:[^\"\\]|\\.)*\")\s*$/gm;
  let match;
  while ((match = re.exec(content))) {
    try {
      inputs.push(JSON.parse(match[1]));
    } catch (err) {
      throw new Error(`Failed to parse input string in ${casesPath}: ${String(err)}`);
    }
  }
  return inputs;
}

function loadJsonInputs(jsonPath) {
  const content = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(content);
  const inputs = [];

  if (Array.isArray(data)) {
    data.forEach((entry) => {
      if (typeof entry?.input === "string") inputs.push(entry.input);
    });
    return inputs;
  }

  if (data && typeof data === "object" && typeof data.input === "string") {
    inputs.push(data.input);
  }
  return inputs;
}

test("Eval suites follow Thing vs concept naming conventions", () => {
  const evalsDir = path.join(REPO_ROOT, "evals");

  const casesFiles = walkFiles(evalsDir, (p) => p.endsWith(".cases"));
  const jsonFiles = walkFiles(evalsDir, (p) => p.endsWith(".json"));

  const failures = [];

  casesFiles.forEach((file) => {
    const inputs = loadCasesInputs(file);
    failures.push(...checkInputs(inputs, `cases:${path.relative(REPO_ROOT, file)}#input`));
  });

  jsonFiles.forEach((file) => {
    const inputs = loadJsonInputs(file);
    failures.push(...checkInputs(inputs, `json:${path.relative(REPO_ROOT, file)}#input`));
  });

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("Explorer demo suite follows naming conventions", () => {
  const failures = [];
  DEMO_SUITE.forEach((example) => {
    const lines = String(example.theory || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    failures.push(...checkInputs(lines, `kbDemo:${example.id}#theory`));
    const commands = (example.steps || []).map((step) => step.command);
    failures.push(...checkInputs(commands, `kbDemo:${example.id}#command`));
  });

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("Explorer UI placeholder examples follow conventions", () => {
  const htmlPath = path.join(REPO_ROOT, "tools", "explorer", "client", "index.html");
  const content = fs.readFileSync(htmlPath, "utf8");
  const violations = findNamingViolations(content);

  const filtered = violations.filter((v) =>
    ["uppercase-after-is-a", "uppercase-after-return-every", "the-prefix-in-name"].includes(v.rule)
  );

  assert.deepEqual(
    filtered,
    [],
    filtered.map((v) => `tools/explorer/client/index.html: ${v.detail}`).join("\n")
  );
});

