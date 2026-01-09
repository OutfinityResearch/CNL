# justifications.mjs

## Summary
Stores provenance for base and derived facts.

## Responsibilities
- Generate FactIDs deterministically.
- Store DerivedFact edges and premise lists.
- Provide justification retrieval for EXPLAIN.

## Key Interfaces
- `makeFactId(predId, subjectId, objectId)`
- `addBaseFact(factId, sourceInfo)`
- `addDerivedFact(factId, ruleId, premiseIds)`
- `getJustification(factId)`

## References
- DS09 for FactID strategy.
- DS11 for explain flow.
