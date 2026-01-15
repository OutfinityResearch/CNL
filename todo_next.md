# TODO Next — Implementation ↔ Specs Alignment

This file is written in English (repo rule). It tracks only actionable engineering tasks and locked decisions.

## Current Status (2026-01-15)

### Deep evals (official Hugging Face datasets)
- Cache directory: `evals/deep/cache/<suite-id>/`
- Canonical cache files are those **without** `__limit-*` in the filename (legacy debug caches may still exist alongside them).
- bAbI location (`facebook/babi_qa`, `en-10k-qa1`, `test`): `200` dataset rows → `1000` executed questions (each row contains multiple Q/A steps).
- ProofWriter mini (`tasksource/proofwriter`, `default`, `validation`): `1000` dataset rows → `1000` executed tests.
- Latest deep report: `evals/results/2026-01-15_12-32-38_deepcheck.md`
  - `babi-location`: `1000 passed, 0 failed, 0 skipped`
  - `proofwriter-mini`: `410 passed, 0 failed, 590 skipped`

### Negation (core syntax + semantics)
- Explicit negation is supported for:
  - unary predicates: `X is not P.` → stored as `U:not|P`
  - passive relations: `X is not <past-participle> by Y.` → stored as `P:not|passive:<verb>|<prep>`
  - active relations: `X does not V Y.` → stored as `P:not|<verb-group>`
  - active relations in relative restrictions: `every thing that does not V Y ...`
- Negation-as-failure remains separate: `it is not the case that ...` is evaluated as “not derivable”.
- Tests:
  - `tests/session/explicit-negation.test.mjs`
  - `tests/parser/negation.test.mjs`

## Locked Decisions (chosen)

### R1 — Benign cross-ontology duplicates
Chosen: keep but de-noise by default (show only probable conflicts in default CLI/UI; keep full detail available via toggle/verbose).

### R2 — Probable cross-ontology conflicts
Chosen: deterministic disambiguation at generation-time for probable conflicts, plus load-time issue collection in-session.

### N1 — Explicit contradiction policy
Chosen: reject contradictions (treat as error and fail transactional load).

### N3 — ProofWriter “Unknown”
Chosen: implement tri-valued semantics (do not skip `unknown`).

## TODO

### R1 — UI/CLI de-noising for benign duplicates
- [ ] Add a CLI and Explorer toggle to show benign duplicates (default off).
- [ ] Ensure “Warnings” defaults to probable conflicts only (per R1).

### R2 — Disambiguation + transparency
- [ ] Ontology → CNL generator: apply deterministic ontology-prefixed renames for “probable conflicts” only.
- [ ] Emit explicit `RenameType:` / `RenamePredicate:` directives so rewrites are transparent.
- [ ] Load-time: collect issues (duplicates/conflicts/renames) into session diagnostics so Explorer can display them.

### N1 + N2 — Contradictory assertions detection & enforcement
- [x] Define and detect `ContradictoryAssertion` (unary + binary).
- [x] Enforce as an error during transactional `learnText()` (per N1).
- [x] Share analyzer across `tools/check-theories.mjs` and session load-time.
- [ ] Explorer: surface dictionary *errors* alongside warnings in the Issues tree (currently only warnings are collected).

### N3 — Tri-valued semantics (`true` / `false` / `unknown`)
- [ ] DS update: define `unknown` for verify/explain and how proofs are represented (DS04/DS11 + DS26).
- [ ] Engine/session: extend results so commands can return `unknown`.
- [ ] `proofwriter-mini`: stop skipping `unknown` and assert expectations against it.
- [ ] Add at least one `unknown` case to smoke evals so regressions are caught early.

### PW1 — ProofWriter rules that reference multiple subjects (not decided yet)
**Problem**
Our current rule IR treats the rule body as describing a single implicit subject set. Many ProofWriter rules are effectively multi-subject Datalog/FOL rules.


*Decision: extend the language/IR to support multi-subject rules**
Idea: allow explicit placeholders/variables in learned rules, or introduce a more general join-based rule body representation.
Pros: higher ProofWriter coverage; more expressive reasoning.
Cons: substantial compiler+engine redesign; more ambiguity and more failure modes.


# Codebase & Specs Review

**Status:** Critical Issues Identified
**Last Update:** 2026-01-14

This document tracks identified discrepancies, technical debt, and required improvements.

---

## X1: FactID Packing Limitation (Critical Scalability Risk)

**Description:**
The `FactID` logic in `src/provenance/justifications.mjs` packs IDs into a 64-bit BigInt using bit-shifting. It allocates only **16 bits** for `subjectId` and `objectId`.
**Impact:**
The system will fail silently or produce corrupt provenance data if the number of entities exceeds **65,536**. This violates the scalability goals of DS09.
**Location:**
`src/provenance/justifications.mjs` -> `makeFactId`

**Decision:**

.  **128-bit BigInt Packing:** Use wider bit ranges if the runtime supports it efficiently. Complex to debug.


---

## X2: Missing `executeProgram` Implementation

**Description:**
The `src/runtime/engine/execute.mjs` module exports `executeProgram`, but it currently throws `"Not implemented"`.
**Impact:**
Users cannot execute a mixed script (rules + commands) sequentially in one go. They are forced to compile first, then execute commands one by one via the API.
**Location:**
`src/runtime/engine/execute.mjs` -> `executeProgram`

**Decision:**
**Compiler Integration:** Enhance the compiler to emit a "ExecutionPlan" that the runtime consumes.


---

## X3: Cognitive Load: Variables vs. Placeholders

**Description:**
There is a semantic collision between Runtime Variables (`?X`) and Compile-Time Placeholders (`X`, `Y`). The parser treats `?X` as a variable, but the compiler has special logic for single-letter names (`X`) in rules.
**Impact:**
Users might write `Rule: If Person matches...` expecting `Person` to be a variable. The compiler treats it as a specific entity named "Person".
**Location:**
`src/parser/grammar/expressions.mjs` vs `src/compiler/compile.mjs`

**Decision:**
.  **Syntax Unification:** Deprecate `X/Y` placeholders and force `?X` usage everywhere (requires major compiler refactor).


---

## X4: Code Smell - `solver.mjs` Monolith

**Description:**
The `solveWithVariables` function in `src/runtime/engine/solver.mjs` is ~200 lines long and handles parsing, domain propagation, backtracking search, and proof formatting in one scope.
**Impact:**
Hard to test, debug, or extend with new constraints (e.g. OR support).
**Location:**
`src/runtime/engine/solver.mjs`

**Decision:**
1.  **Extract Components:** Move `buildSolveConstraints`, `propagateDomains`, and the `search` recursive function into distinct, exported helper functions.

---

## X5: Hardcoded Limits (Magic Numbers)

**Description:**
Search depths and solution limits are hardcoded constants.
**Impact:**
Users cannot configure the effort/timeout for complex problems.
*   `plan.mjs`: `maxDepth = 6`, `maxNodes = 200`.
*   `solver.mjs`: `maxSolutions = 25`, `maxTraceSteps = 250`.
    **Location:**
    `src/runtime/engine/plan.mjs`, `src/runtime/engine/solver.mjs`

**Decision:****Config Object:** Pass a `config` object through `state` or command arguments (e.g., `Plan (depth=10)...`).





## X7: Code Smell - `conditions.mjs` Parser Complexity

**Description:**
`parseConditionTokens` performs multiple passes over the token array to handle precedence (`Either/Or`, `Both/And`, `And`, `Or`). It uses ad-hoc scanning (`splitByOperator`, `tokensAreWrapped`).
**Impact:**
Fragile logic, hard to extend with new operators (e.g., `XOR`), potential performance bottleneck on deep expressions.
**Location:**
`src/parser/grammar/conditions.mjs`

**Decision:**
.  **Pratt Parser:** Switch to a Pratt (Top-Down Operator Precedence) parser for expressions and conditions.

---
