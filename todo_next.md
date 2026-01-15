# TODO Next

This file is written in English (repo rule). Keep only:
1) tasks that must be implemented next, and/or
2) tasks that require a user decision (with at most 2–3 options).

Current status:
- `npm run tests` PASS
- `npm run evals` PASS
- `npm run checkTheories` PASS (no errors; warnings are expected for large ontology bundles)

References:
- Theory issues/warnings/errors: `docs/specs/DS/DS24-theory-consistency.md`
- Vocabulary renames: `docs/specs/DS/DS25-vocabulary-renames.md`
- Ontology import: `docs/specs/DS/DS22-ontology-import.md`

## Decisions Needed

### R2 follow-up — Where should disambiguation live? (DS22/DS25)
We currently keep collision resolution transparent and explicit via `RenamePredicate` directives in bundle entrypoints (examples: `theories/base.cnl`, `theories/base.formal.cnl`).

Decision (choose one):
1) Keep renames in entrypoints (status quo).
   - Pros: simple, visible, fast to tweak; no regeneration needed.
   - Cons: renames are global within the bundle; less attribution to the source ontology.
2) Move renames into generated ontology bundles.
   - Pros: renames live next to the vocabulary they affect; better attribution/audit trail.
   - Cons: requires regeneration discipline; importer needs a deterministic collision policy.
