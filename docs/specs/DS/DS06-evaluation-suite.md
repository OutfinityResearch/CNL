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

## Parsing Evaluation Summary
The parsing suite includes canonical corpora with both valid and invalid cases:
- Files: `evals/parsing/cnl-pl-parser.v1.json`, `evals/parsing/cnl-pl-actions-and-labels.v1.json`, `evals/parsing/cnl-pl-labels.v1.json`.
- Valid cases: V001-V049 (atomic assertions, commands, rules, relative clauses, action blocks, transition rules).
- Invalid cases: X001-X028 (missing terminators, mixed operators, invalid comparators, malformed blocks, label syntax).
- Expected results: full AST matches for valid inputs and DS07 error objects for invalid inputs.

## Reporting
- Track pass/fail with version tags.
- Include diff reports for AST mismatches.

## Related Specs
- DS03 for grammar determinism.
- DS04 for semantic expectations.
- DS05 for unit testing alignment.
- DS07 for error code definitions used in invalid cases.
