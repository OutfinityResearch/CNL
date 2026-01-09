# Evaluation Suites

## Purpose
Evaluation suites validate end-to-end parsing and reasoning behavior. They are larger than unit tests and focus on expected outcomes and traceability.

## Planned Suites
- `evals/parsing/` - parsing cases with expected AST summaries.
- `evals/reasoning/` - proof and explanation cases.
- `evals/planning/` - action planning scenarios.
- `evals/solve/` - constraint solving scenarios.
 - `evals/query/` - query cases for Return commands.
 - `evals/proof/` - proof cases for Verify commands.
- `evals/simulate/` - simulation cases for transition rules.
- `evals/explain/` - explain cases for justification traces.
- `evals/kbDemo/` - demo suite for small end-to-end reasoning scenarios.
  - BaseDictionary parsing and compiler cases live alongside the parsing/reasoning suites.

## Compiler Evaluation
- `evals/reasoning/compiler.v1.json` is executed by `evals/runCompilerEval.mjs`.
 - `evals/runReasoning.mjs`, `evals/runQuery.mjs`, `evals/runProof.mjs`, `evals/runPlan.mjs`,
   `evals/runSolve.mjs`, `evals/runSimulate.mjs`, `evals/runExplain.mjs` execute the `.cases` suites.
 - `evals/runAll.mjs` runs all eval suites and prints a summary.

## Reasoning Examples
- `evals/reasoning/mini-theories.cases` contains compact CNL theories for common proof/query patterns.

## Canonical Parsing Corpus
- `evals/parsing/cnl-pl-parser.v1.json` provides the baseline valid/invalid parser cases.
- `evals/parsing/cnl-pl-actions-and-labels.v1.json` adds action block and label syntax cases.
- `evals/parsing/cnl-pl-labels.v1.json` focuses on missing colon errors for Rule/Command labels.

## Documentation
Each suite file should have a mirror description in this folder using the same relative path with `.md` appended.
