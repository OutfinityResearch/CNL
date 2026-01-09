# store.mjs

## Summary
Stores formula nodes for non-atomic propositions and constraints.

## Responsibilities
- Represent NOT/AND/OR/IMPLIES nodes over FactIDs.
- Provide lookup by PropID for proof and explain.

## Key Interfaces
- `addFormula(node)`
- `getFormula(propId)`

## References
- DS11 for proposition handling.
- DS15 for constraint emission.
