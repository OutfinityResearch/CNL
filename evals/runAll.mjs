import { spawn } from "node:child_process";

const suites = [
  { name: "Parsing", command: "node evals/runParsingEval.mjs", group: "Core" },
  { name: "Compiler", command: "node evals/runCompilerEval.mjs", group: "Core" },
  { name: "Reasoning", command: "node evals/runReasoning.mjs", group: "Reasoning" },
  { name: "KBDemo", command: "node evals/runKBDemo.mjs", group: "Reasoning" },
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
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function padCell(text, width) {
  return String(text ?? "").padEnd(width);
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`\n${colors.cyan}▶ Running ${suite.name}...${colors.reset}`);
    
    // We keep stdio inherit so user sees progress/errors in real time
    const proc = spawn(suite.command, { shell: true, stdio: "inherit" });
    
    proc.on("exit", (code) => {
      const duration = Date.now() - start;
      resolve({ 
        ...suite,
        code: code ?? 1, 
        duration 
      });
    });
  });
}

async function main() {
  console.log(`${colors.cyan}Starting evaluation suite...${colors.reset}`);
  
  const results = [];
  for (const suite of suites) {
    const result = await runSuite(suite);
    results.push(result);
  }

  const failed = results.filter(r => r.code !== 0);
  
  // Render Summary Table
  console.log(`\n${colors.cyan}Evaluation Summary${colors.reset}`);
  
  const columns = [
    { key: "status", label: "Status" },
    { key: "name", label: "Suite" },
    { key: "group", label: "Group" },
    { key: "time", label: "Time" },
    { key: "info", label: "Info" }
  ];

  // Prepare rows
  const rows = results.map(r => ({
    status: r.code === 0 ? "PASS" : "FAIL",
    name: r.name,
    group: r.group,
    time: formatDuration(r.duration),
    info: r.code !== 0 ? `Exit ${r.code}` : "",
    raw: r // keep raw for coloring
  }));

  // Calculate widths
  const widths = columns.map(c => c.label.length);
  rows.forEach(r => {
    columns.forEach((c, i) => {
      widths[i] = Math.max(widths[i], String(r[c.key]).length);
    });
  });

  // Header
  const header = columns.map((c, i) => padCell(c.label, widths[i])).join(" | ");
  const separator = widths.map(w => "-".repeat(w)).join("-+-");
  
  console.log(header);
  console.log(separator);

  // Body
  rows.forEach(row => {
    const line = columns.map((c, i) => {
      const val = padCell(row[c.key], widths[i]);
      if (c.key === "status") {
        const color = row.status === "PASS" ? colors.green : colors.red;
        return `${color}${val}${colors.reset}`;
      }
      return val;
    }).join(" | ");
    console.log(line);
  });

  // Final status
  console.log("");
  if (failed.length === 0) {
    console.log(`${colors.green}All ${results.length} suites passed.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${failed.length} of ${results.length} suites failed.${colors.reset}`);
    process.exit(1);
  }
}

main();
