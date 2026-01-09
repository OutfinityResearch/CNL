# Evaluation Suites

## Purpose
Evaluation suites validate end-to-end parsing and reasoning behavior. They are larger than unit tests and focus on expected outcomes and traceability.

## Planned Suites
- `evals/parsing/` - parsing cases with expected AST summaries.
- `evals/reasoning/` - proof and explanation cases.
- `evals/planning/` - action planning scenarios.
- `evals/solve/` - constraint solving scenarios.

## Canonical Parsing Corpus
- `evals/parsing/cnl-pl-parser.v1.json` provides the baseline valid/invalid parser cases.
- `evals/parsing/cnl-pl-actions-and-labels.v1.json` adds action block and label syntax cases.
- `evals/parsing/cnl-pl-labels.v1.json` focuses on missing colon errors for Rule/Command labels.

## Documentation
Each suite file should have a mirror description in this folder using the same relative path with `.md` appended.
