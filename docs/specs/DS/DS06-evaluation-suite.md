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
- Compiler suite: inputs mapped to KB summary counts (no inference).

## Output Expectations
- Parsing: structured JSON match against an expected subset (extra AST fields such as spans are allowed).
- Reasoning: boolean success with optional (and increasingly required) proof trace (DS18).
- Planning: ordered action list when actions are available (empty list when already satisfied).
- Solving: variable bindings that satisfy constraints.
- Compiler: KB summary counts for unary/binary/numeric/entity-attr facts.

Pragmatics suites may assert ProofTrace properties beyond the primary answer:
- `proofMode` (e.g. `Derivation`, `Universal`, `Witness`)
- substring checks over `proof.steps` / `proof.premises` (e.g. `proofStepsInclude`, `proofPremisesInclude`)

## Dataset Structure
- `evals/parsing/` - case files and expected AST outputs.
- `evals/reasoning/` - proof and explanation cases.
- `evals/planning/` - action plan scenarios.
- `evals/solve/` - CSP scenarios.
- `evals/reasoning/compiler.v1.json` - compiler output summaries.

## Parsing Evaluation Summary
The parsing suite includes canonical corpora with both valid and invalid cases:
- Files: `evals/parsing/cnl-pl-parser.v1.json`, `evals/parsing/cnl-pl-actions-and-labels.v1.json`, `evals/parsing/cnl-pl-labels.v1.json`.
- Feature coverage: `evals/parsing/cnl-pl-parser-features.v1.json` (Solve variables, CaseScope, aggregations, action blocks).
- Valid cases: V001-V049 (atomic assertions, commands, rules, relative clauses, action blocks, transition rules).
- Invalid cases: X001-X028 (missing terminators, mixed operators, invalid comparators, malformed blocks, label syntax).
- Expected results: subset AST matches for valid inputs and DS07 error objects for invalid inputs.

## Reporting
- Track pass/fail with version tags.
- Include diff reports for AST mismatches.

## Related Specs
- DS03 for grammar determinism.
- DS04 for semantic expectations.
- DS05 for unit testing alignment.
- DS07 for error code definitions used in invalid cases.
