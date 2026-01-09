# DS02 - Implementation Plan

## Summary
This document maps the intended runtime structure to mirrored design specs and outlines the delivery milestones for CNL-PL.

## Planned Repository Layout
- `src/`
  - `lexer/` - tokenization, keyword matching, and spans
  - `parser/` - grammar implementation and AST construction
  - `ast/` - AST node definitions and serialization
  - `validator/` - grammar and determinism errors
  - `pragmatics/` - query, proof, plan, solve, simulate, explain
  - `runtime/` - execution adapters and orchestration
- `tests/`
  - `lexer/`, `parser/`, `validator/`, `pragmatics/`
- `evals/`
  - parsing suites, reasoning suites, expected outputs

## Specs Mirroring
Each runtime file will have a mirrored design note:
- `src/**/file.ext` has a documentation mirror at `docs/specs/src/**/file.ext.md`.
- `tests/**/file.ext` has a documentation mirror at `docs/specs/tests/**/file.ext.md`.
- `evals/**/suite.ext` has a documentation mirror at `docs/specs/evals/**/suite.ext.md`.

## Milestones
1. Grammar implementation: lexer + parser + AST schema.
2. Validation layer: error detection for determinism rules.
3. Pragmatic command parsing for Query/Proof/Plan/Solve/Simulate/Optimize/Explain.
4. Core runtime adapters for a minimal query and proof pipeline.
5. Test suite coverage and evaluation benchmarks.

## Deliverables
- Grammar and AST implementation aligned with DS03.
- Semantic interpretation plan aligned with DS04.
- Automated testing plan aligned with DS05.
- Evaluation suite aligned with DS06.
- Error handling spec aligned with DS07.

## Open Questions
- Runtime language (implementation platform) selection.
- Primary target backend for proof/solve.
- Format for evaluation expected outputs (JSON vs CNL).
