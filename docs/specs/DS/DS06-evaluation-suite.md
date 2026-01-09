# DS06 - Evaluation Suite

## Summary
Defines the evaluation suites for CNL-PL, including parsing benchmarks and reasoning/execution verification. This suite is distinct from unit tests and focuses on end-to-end behavior.

## Goals
- Measure parsing correctness and determinism across representative corpora.
- Validate reasoning behavior for proof, plan, solve, and explain.
- Track regressions across versions.

## Suite Types
- Parsing suite: inputs mapped to expected AST summaries or hashes.
- Reasoning suite: inputs mapped to expected outputs and explanation traces.
- Pragmatics suite: query, plan, solve, and simulate scenarios with expected results.

## Output Expectations
- Parsing: AST hash or structured JSON match.
- Reasoning: boolean success with optional proof trace.
- Planning: ordered action list with justification.
- Solving: variable bindings that satisfy constraints.

## Dataset Structure
- `evals/parsing/` - case files and expected AST outputs.
- `evals/reasoning/` - proof and explanation cases.
- `evals/planning/` - action plan scenarios.
- `evals/solve/` - CSP scenarios.

## Reporting
- Track pass/fail with version tags.
- Include diff reports for AST mismatches.

## Related Specs
- DS03 for grammar determinism.
- DS04 for semantic expectations.
- DS05 for unit testing alignment.
