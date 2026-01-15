# TODO Next — Implementation ↔ Specs Alignment

This file is intentionally written in English (repo rule) and focuses on concrete, actionable next steps.



## Open Tasks

### R1 — Cross-ontology duplicates: classify “benign” vs “conflict”
**Problem**
Multiple ontologies define the same type/predicate surface form. Some duplicates are harmless synonyms; others are genuine semantic conflicts.

**Status**
We already detect both:
- `DuplicateTypeDeclaration` / `DuplicatePredicateDeclaration` (benign duplicates)
- `DuplicateTypeDifferentParents` / `DuplicatePredicateDifferentConstraints` (probable conflicts)

**Decision**
How should we treat benign duplicates by default in CLI/UI?

** keep but de-noise**
- Keep all duplicates recorded internally.
- In default output/UI, only show “probable conflicts” as warnings.
- Show benign duplicates only under a “Show benign duplicates” toggle or `--verbose`.
Pros: less noise; keeps evidence for audits.
Cons: some users may miss “silent” duplication.

---

### R2 — What to do with “probable conflicts”
**Problem**
For conflicts such as different domain/range constraints for the same predicate key, reporting as warnings may be insufficient.

**Decision **
 we disambiguate automatically at generation-time but also at the load time put in issue things collected in the session

** deterministic disambiguation at generation**
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

**Decision **
What is the enforcement policy?

**reject contradictions**
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

**Decision **

** implement 3-valued semantics**
- Extend DS04/DS11 and engine results to support `unknown`.
