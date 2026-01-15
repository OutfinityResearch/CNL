# TODO Next — Implementation ↔ Specs Alignment

This file is intentionally written in English (repo rule) and focuses on concrete, actionable next steps.

## Current Status (as of 2026-01-15)

### Deep evals (Hugging Face official datasets)
- `runDeep.mjs` runs deep suites and writes `evals/results/<timestamp>_deepcheck.md`.
- Datasets are cached under `evals/deep/cache/<suite-id>/` as JSONL from `datasets-server.huggingface.co`.
- **Important:** one dataset “row” may contain multiple questions/steps, so 20 cached rows can yield 100 executed deep tests (bAbI rows often contain 5 questions).

### Explicit negation (core semantics)
- Explicit negation is supported for:
  - unary predicates: `X is not P.` → stored as `U:not|P`
  - passive relations: `X is not <past-participle> by Y.` → stored as `P:not|passive:<verb>|<prep>`
- Negation-as-failure remains separate: `it is not the case that ...` is evaluated as “not derivable”.
- New unit tests exist: `tests/session/explicit-negation.test.mjs`.

## Open Tasks

### R1 — Cross-ontology duplicates: classify “benign” vs “conflict”
**Problem**
Multiple ontologies define the same type/predicate surface form. Some duplicates are harmless synonyms; others are genuine semantic conflicts.

**Status**
We already detect both:
- `DuplicateTypeDeclaration` / `DuplicatePredicateDeclaration` (benign duplicates)
- `DuplicateTypeDifferentParents` / `DuplicatePredicateDifferentConstraints` (probable conflicts)

**Decision needed**
How should we treat benign duplicates by default in CLI/UI?

**Option A (recommended): keep but de-noise**
- Keep all duplicates recorded internally.
- In default output/UI, only show “probable conflicts” as warnings.
- Show benign duplicates only under a “Show benign duplicates” toggle or `--verbose`.
Pros: less noise; keeps evidence for audits.
Cons: some users may miss “silent” duplication.

**Option B: always report all duplicates**
- Always surface benign duplicates as warnings in both `checkTheories` and Explorer.
Pros: fully transparent.
Cons: warning fatigue (hundreds of warnings in `base.formal`).

---

### R2 — What to do with “probable conflicts”
**Problem**
For conflicts such as different domain/range constraints for the same predicate key, reporting as warnings may be insufficient.

**Decision needed**
Do we disambiguate automatically at generation-time?

**Option A: warn-only, no automatic renames**
Pros: preserves original vocabulary; avoids hidden rewrites.
Cons: ambiguous keys remain ambiguous across bundles.

**Option B (recommended): deterministic disambiguation at generation**
- Only for “probable conflicts”, apply deterministic ontology-prefixed renames at generation-time.
- Emit explicit `RenameType:` / `RenamePredicate:` directives so the rewrite stays transparent and debuggable.
Pros: removes ambiguity; keeps traceability.
Cons: introduces more vocabulary variants.

---

### N1 — Contradictions between explicit positive vs explicit negation
**Problem**
With explicit negation, the KB may contain both:
```
X is valid.
X is not valid.
```
This should be detectable and visible as a warning/error, not silently ignored.

**Decision needed**
What is the enforcement policy?

**Option A (recommended): paraconsistent warning-only**
- Keep both facts.
- Emit `ContradictoryAssertion` warning (load-time + check-theories + Explorer Warnings).
Pros: preserves information; avoids “magic deletes”; supports inconsistent data ingestion.
Cons: “Verify that X is valid.” and “Verify that X is not valid.” can both be true.

**Option B: reject contradictions**
- Treat as an error and fail the load (transactional learn), or ignore the later insertion.
Pros: enforces consistency.
Cons: breaks datasets/theories that include explicit negation patterns; may be too strict.

---

### N2 — Add contradiction analysis to `checkTheories` + session + Explorer
Depends on decision in **N1**.

**Proposed deliverable**
- New issue kind: `ContradictoryAssertion` with details:
  - entity key, positive key, negated key, source file/line if known
  - for binary: `(subject, predicate, object)` vs its negated predicate
- Same code path used by:
  - `tools/check-theories.mjs`
  - `CNLSession.learnText()` (load-time warnings)
  - Explorer “Warnings” tree

---

### N3 — Deep eval coverage: ProofWriter “Unknown”
**Problem**
ProofWriter has tri-valued ground truth: `True` / `False` / `Unknown`.
We currently skip `Unknown`.

**Decision needed**

**Option A: keep skipping `Unknown` in v1**
Pros: avoids incorrect semantics.
Cons: smaller coverage.

**Option B: implement 3-valued semantics**
- Extend DS04/DS11 and engine results to support `unknown`.
Pros: faithful benchmark coverage.
Cons: larger semantics/engine change; requires proof/explain policy for unknown.

## Notes / Cleanups
- If you want “1000 examples” in the cache: we should cache at least 1000 dataset rows per suite entrypoint (not 20), but remember that this can translate to several thousand executed tests depending on dataset structure.

