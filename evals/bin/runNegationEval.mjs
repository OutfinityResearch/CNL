import { runCaseSuite } from "./cases-runner.mjs";
import { parseProgram } from "../../src/parser/grammar.mjs";

const args = process.argv.slice(2);
const fileUrl = args[0] ? new URL(args[0], `file://${process.cwd()}/`) : new URL("../../evals/parsing/negation.cases", import.meta.url);

function isObject(value) {
  return value !== null && typeof value === "object";
}

function describeNegation(node) {
  if (!node || node.negated !== true || !node.kind) return null;
  switch (node.kind) {
    case "CopulaPredicateAssertion":
      return { kind: node.kind, complement: node.complement?.value ?? null };
    case "RelCopulaPredicate":
      return { kind: node.kind, complement: node.complement?.value ?? null };
    case "PassiveRelationAssertion":
      return { kind: node.kind, verb: node.verb ?? null, preposition: node.preposition ?? null };
    case "ActiveRelationAssertion":
      return {
        kind: node.kind,
        verb: node.verbGroup?.verb ?? null,
        particles: Array.isArray(node.verbGroup?.particles) ? node.verbGroup.particles : [],
      };
    default:
      return { kind: node.kind };
  }
}

function collectNegations(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectNegations(entry, out);
    return;
  }
  if (!isObject(value)) return;

  const described = describeNegation(value);
  if (described) out.push(described);

  for (const entry of Object.values(value)) {
    collectNegations(entry, out);
  }
}

function summarizeNegationAst(ast) {
  const negations = [];
  collectNegations(ast, negations);
  return { count: negations.length, negations };
}

await runCaseSuite({
  fileUrl,
  title: "Negation Parsing",
  evaluate: ({ input }) => summarizeNegationAst(parseProgram(input)),
  compare: (testCase, output) => JSON.stringify(output) === JSON.stringify(testCase.expect),
  formatOutput: (output) => JSON.stringify(output),
});
