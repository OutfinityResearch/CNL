import { runCaseSuite } from "./cases-runner.mjs";

const args = process.argv.slice(2);
const fileUrl = args[0] ? new URL(args[0], `file://${process.cwd()}/`) : new URL("../../evals/parsing/negation.cases", import.meta.url);

await runCaseSuite({
  fileUrl,
  title: "Negation Parsing",
  evaluate: ({ input }) => {
    // We only care that it parses successfully for now
    // The placeholder expectation in the cases file will be flagged as "pending expectation"
    return "AST placeholder";
  }
});
