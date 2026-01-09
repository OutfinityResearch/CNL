import { spawn } from "node:child_process";

const suites = [
  { name: "Parsing", command: "node evals/runParsingEval.mjs", group: "Core" },
  { name: "Compiler", command: "node evals/runCompilerEval.mjs", group: "Core" },
  { name: "Reasoning", command: "node evals/runReasoning.mjs", group: "Reasoning" },
  { name: "Query", command: "node evals/runQuery.mjs", group: "Pragmatics" },
  { name: "Proof", command: "node evals/runProof.mjs", group: "Pragmatics" },
  { name: "Plan", command: "node evals/runPlan.mjs", group: "Pragmatics" },
  { name: "Solve", command: "node evals/runSolve.mjs", group: "Pragmatics" },
  { name: "Simulate", command: "node evals/runSimulate.mjs", group: "Pragmatics" },
  { name: "Explain", command: "node evals/runExplain.mjs", group: "Pragmatics" },
];

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

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

function runSuite(suite) {
  return new Promise((resolve) => {
    const proc = spawn(suite.command, { shell: true, stdio: "inherit" });
    proc.on("exit", (code) => {
      resolve({ name: suite.name, code: code ?? 1 });
    });
  });
}

const results = [];
for (const suite of suites) {
  const result = await runSuite(suite);
  results.push(result);
}

const failed = results.filter((result) => result.code !== 0);
const passed = results.filter((result) => result.code === 0);
const groupOrder = ["Core", "Reasoning", "Pragmatics"];
const groupTitles = {
  Core: "Core evals",
  Reasoning: "Reasoning evals",
  Pragmatics: "Pragmatics evals",
};
const suiteByName = new Map(suites.map((suite) => [suite.name, suite]));

for (const group of groupOrder) {
  const rows = results
    .filter((result) => suiteByName.get(result.name)?.group === group)
    .map((result) => ({
      status: result.code === 0 ? "PASS" : "FAIL",
      suite: result.name,
    }));
  renderTable(groupTitles[group], [
    { key: "status", label: "Status" },
    { key: "suite", label: "Suite" },
  ], rows, colors);
}

console.log(`\nPassed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length > 0) {
  renderTable("Failed suites", [
    { key: "status", label: "Status" },
    { key: "suite", label: "Suite" },
  ], failed.map((item) => ({ status: "FAIL", suite: item.name })), colors);
  process.exit(1);
}
