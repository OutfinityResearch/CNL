import fs from "node:fs";
import path from "node:path";
import { parseProgram } from "../../../src/parser/grammar.mjs";
import { CNLSession } from "../../../src/session/cnl-session.mjs";
import { summarizeResult } from "./result-format.mjs";

function lastCommandItem(ast) {
  if (!ast || ast.kind !== "Program") return null;
  return [...ast.items].reverse().find((item) => item.kind === "CommandStatement") || null;
}

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function normalizeQueryEntities(result) {
  const entities = result?.entities || [];
  return entities.map((e) => displayEntityKey(e.key)).sort();
}

function compareExpected(expected, result) {
  if (!expected) return { ok: true, note: "no expectation" };
  if (!result) return { ok: false, note: "missing result" };
  if (result.error) return { ok: false, note: result.error.message || String(result.error) };

  if (expected.kind === "proof") {
    if (result.kind !== "ProofResult") return { ok: false, note: `expected ProofResult, got ${result.kind}` };
    return { ok: Boolean(result.value) === Boolean(expected.value), note: String(result.value) };
  }

  if (expected.kind === "query") {
    if (result.kind !== "QueryResult" && result.kind !== "SolveResult") {
      return { ok: false, note: `expected QueryResult/SolveResult, got ${result.kind}` };
    }
    const actual = normalizeQueryEntities(result);
    const want = (expected.values || []).map(String).sort();
    const ok = JSON.stringify(actual) === JSON.stringify(want);
    return { ok, note: JSON.stringify(actual) };
  }

  return { ok: false, note: `unknown expected kind: ${expected.kind}` };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export async function runDeepSuite(suite, options = {}) {
  const suiteDir = options.suiteDir;
  const baseEntrypoint = suite.baseEntrypoint ?? null;
  const maxCases = options.maxCases ?? null;

  const cases = await suite.loadCases({ suiteDir, options });
  const translated = [];
  for (const ex of cases) {
    const tests = await suite.translateExample(ex, { suiteDir, options });
    for (const t of tests || []) translated.push(t);
    if (maxCases && translated.length >= maxCases) break;
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  for (const test of translated) {
    if (test.skip) {
      skipped += 1;
      continue;
    }
    const session = new CNLSession({ ...(baseEntrypoint ? { baseEntrypoint } : {}) });

    const learnRes = session.learnText(test.cnl.theory, { transactional: true });
    if (learnRes?.errors?.length) {
      failed += 1;
      failures.push({
        ...test,
        error: learnRes.errors[0]?.message ?? "learn error",
        phase: "learn",
      });
      continue;
    }

    let ast = null;
    try {
      ast = parseProgram(test.cnl.command);
    } catch (err) {
      failed += 1;
      failures.push({
        ...test,
        error: err?.message ?? "parse error",
        phase: "parse",
      });
      continue;
    }

    const cmdItem = lastCommandItem(ast);
    if (!cmdItem) {
      failed += 1;
      failures.push({
        ...test,
        error: "missing command",
        phase: "parse",
      });
      continue;
    }

    let result = null;
    try {
      const kind = cmdItem.command.kind;
      if (kind === "ReturnCommand" || kind === "FindCommand") result = session.query(test.cnl.command, { deduce: true });
      else if (kind === "VerifyCommand") result = session.proof(test.cnl.command, { deduce: true });
      else if (kind === "ExplainCommand") result = session.explain(test.cnl.command, { deduce: true });
      else if (kind === "PlanCommand") result = session.plan(test.cnl.command, { deduce: true });
      else if (kind === "SolveCommand") result = session.solve(test.cnl.command, { deduce: true });
      else if (kind === "SimulateCommand") result = session.simulate(test.cnl.command, { deduce: true });
      else if (kind === "MaximizeCommand" || kind === "MinimizeCommand") result = session.optimize(test.cnl.command, { deduce: true });
      else result = { error: { message: `unsupported command: ${kind}` } };
    } catch (err) {
      result = { error: { message: err?.message ?? "command error" } };
    }

    const cmp = compareExpected(test.expected, result);
    if (!cmp.ok) {
      failed += 1;
      failures.push({
        ...test,
        actual: summarizeResult(result, session),
        error: cmp.note,
        phase: "execute",
      });
      continue;
    }

    passed += 1;
  }

  return {
    id: suite.id,
    title: suite.title,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    failures,
  };
}

export function writeDeepReport(reportPath, markdown) {
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, markdown, "utf8");
}
