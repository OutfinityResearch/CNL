import { spawn } from "node:child_process";

const suites = [
  { name: "Parsing", command: "node evals/runParsingEval.mjs" },
  { name: "Compiler", command: "node evals/runCompilerEval.mjs" },
  { name: "Reasoning", command: "node evals/runReasoning.mjs" },
  { name: "Query", command: "node evals/runQuery.mjs" },
  { name: "Proof", command: "node evals/runProof.mjs" },
  { name: "Plan", command: "node evals/runPlan.mjs" },
  { name: "Solve", command: "node evals/runSolve.mjs" },
  { name: "Simulate", command: "node evals/runSimulate.mjs" },
  { name: "Explain", command: "node evals/runExplain.mjs" },
];

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

console.log("\nSummary:");
for (const result of results) {
  const status = result.code === 0 ? "PASS" : "FAIL";
  console.log(`- ${status}: ${result.name}`);
}

console.log(`\nPassed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length > 0) {
  console.log("Failed suites:");
  for (const item of failed) {
    console.log(`- ${item.name}`);
  }
  process.exit(1);
}
