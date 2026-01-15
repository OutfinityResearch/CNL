import { parseProgram } from "../../src/parser/grammar.mjs";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { DEMO_SUITE } from "../../evals/kbDemo/suite.mjs";
import { displayEntityKey } from "../../src/utils/display-keys.mjs";

function summarize(result) {
  if (!result) return "";
  switch (result.kind) {
    case "QueryResult":
    case "SolveResult":
      return JSON.stringify(result.entities.map((entry) => displayEntityKey(entry.key)));
    case "ProofResult":
      return String(result.value);
    case "ExplainResult":
      if (result.baseFacts && result.baseFacts.length > 0) {
        return result.baseFacts.join(" | ");
      }
      return result.justification?.kind ?? "explain";
    case "PlanResult":
      return result.status ?? "";
    case "SimulationResult":
      return `steps=${result.steps}`;
    case "OptimizeResult":
      return `${result.status}:${result.value}`;
    default:
      return "";
  }
}

async function run() {
  console.log("Running KB Demo Suite...\n");
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const group of DEMO_SUITE) {
    console.log(`[${group.title}]`);
    const session = new CNLSession();
    
    // 1. Learn Theory
    const learnRes = session.learnText(group.theory);
    if (learnRes.errors && learnRes.errors.length > 0) {
      console.error(`  FAIL: Learn phase failed.`);
      learnRes.errors.forEach(e => console.error("    " + e.message));
      failed++;
      continue;
    }

    // 2. Execute Steps
    for (const step of group.steps) {
      let ast = null;
      try {
        ast = parseProgram(step.command);
      } catch (err) {
        console.log(`  FAIL: ${step.command}`);
        console.error(`    ${err?.message ?? "parse error"}`);
        failed++;
        continue;
      }
      const commandItem = ast.items.find((item) => item.kind === "CommandStatement");
      if (!commandItem) {
        console.log(`  FAIL: ${step.command}`);
        console.error("    missing command");
        failed++;
        continue;
      }

      let result = null;
      switch (commandItem.command.kind) {
        case "ReturnCommand":
        case "FindCommand":
          result = session.query(step.command, { deduce: true });
          break;
        case "SolveCommand":
          result = session.solve(step.command);
          break;
        case "VerifyCommand":
          result = session.proof(step.command);
          break;
        case "ExplainCommand":
          result = session.explain(step.command);
          break;
        case "PlanCommand":
          result = session.plan(step.command);
          break;
        case "SimulateCommand":
          result = session.simulate(step.command);
          break;
        case "MaximizeCommand":
        case "MinimizeCommand":
          result = session.optimize(step.command);
          break;
        default:
          result = { error: { message: "Unsupported command." } };
      }

      if (result?.error) {
        console.log(`  FAIL: ${step.command}`);
        console.error(`    ${result.error.message ?? "command error"}`);
        failed++;
        continue;
      }

      const output = summarize(result);
      if (step.expectedMatches && step.expectedMatches.length > 0) {
        const ok = step.expectedMatches.some((token) => output.includes(token));
        if (!ok) {
          console.log(`  FAIL: ${step.command}`);
          console.log(`        Expected match: ${step.expectedMatches.join(" | ")}`);
          console.log(`        Found: ${output}`);
          failed++;
          continue;
        }
        console.log(`  PASS: ${step.command}`);
        passed++;
        continue;
      }

      if (step.expected !== undefined && step.expected !== null) {
        if (String(step.expected) !== output) {
          console.log(`  FAIL: ${step.command}`);
          console.log(`        Expected: ${step.expected}`);
          console.log(`        Found: ${output}`);
          failed++;
          continue;
        }
      }

      if (!step.expected) {
        skipped++;
        console.log(`  SKIP: ${step.command}`);
        continue;
      }

      console.log(`  PASS: ${step.command}`);
      passed++;
    }
    console.log("");
  }

  console.log(`Result: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
  // We exit with 0 to not break CI if we expect failures due to missing features
  // But strictly speaking, failures should exit(1).
  process.exit(failed > 0 ? 1 : 0);
}

run();
