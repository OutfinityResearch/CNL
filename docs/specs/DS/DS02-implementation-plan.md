# DS02 - Implementation Plan

## Summary
This document maps the runtime structure to mirrored design specs and defines the documentation and delivery milestones for CNL-PL. It is a living map of the repository layout.

## Current Repository Layout
The codebase is organized by responsibility and mirrored by specs:

- `src/`
  - `actions/` - action blocks, preconditions, and effects
  - `ast/` - AST node helpers and minimal constructors
  - `compiler/` - AST compilation and plan building
  - `formulas/` - formula store for compound propositions
  - `ids/` - interners and ConceptualID/dense ID mapping
  - `kb/` - compiled KB structures, bitsets, numeric indexes
  - `lexer/` - tokenization, keywords, and spans
  - `parser/` - grammar and AST construction
  - `plans/` - plan IR and plan execution
  - `pragmatics/` - command-level planning (query/proof/solve/etc)
  - `provenance/` - justification tracking for explain
  - `rules/` - rule store and rule execution support
  - `runtime/` - engine orchestration
  - `session/` - session-level API and orchestration
  - `theories/` - base theories and reusable axioms

- `tests/`
  - `compiler/`, `kb/`, `lexer/`, `parser/`, `pragmatics/`, `rules/`, `validator/`
  - `developer/` and `plans/` for integration-level coverage

- `evals/`
  - `parsing/`, `reasoning/`, `planning/`, `solve/` suites and expected outputs

- `docs/`
  - Presentation pages, theory, architecture, syntax, wiki, and specs

## Specs Mirroring
Each runtime file has a mirrored design note:
- `src/**/file.ext` -> `docs/specs/src/**/file.ext.md`
- `tests/**/file.ext` -> `docs/specs/tests/**/file.ext.md`
- `evals/**/suite.ext` -> `docs/specs/evals/**/suite.ext.md`

Design specs in `docs/specs/DS/` define the normative behavior for each subsystem.

## Documentation Maintenance Rules
- When a new runtime module is added, add a mirrored spec file.
- When a runtime module is removed or renamed, update DS02 and the mirror index.
- If the repository layout changes, DS02 is the first document to update.

## Milestones
1. Grammar and AST stabilization (lexer + parser + determinism validation).
2. Compiler contract and KB layout (DS08-DS11 + DS15).
3. Pragmatic engines (query, proof, solve, plan, simulate, optimize, explain).
   - Execution/proof contracts: DS18-DS21.
4. Provenance and justification support for explain/proof.
5. Full coverage with unit tests and eval suites.

## Resolved Decisions
- Implementation language: JavaScript with `.mjs` modules.
- Deterministic parsing: no heuristic rewrites, no synonym expansion.

## Open Questions
### Resolved (v1)
- Reasoning backend: custom in-repo engines (compiled KB + rule materialization), not an external backend.
- Proof/explain output format: standardized proof traces (see DS18).

### Still open
- Long-term persistence format for ConceptualID and dense ID maps (v1 is in-memory; persistence is deferred).
