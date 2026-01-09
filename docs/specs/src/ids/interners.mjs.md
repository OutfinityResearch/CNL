# interners.mjs

## Summary
Manages ConceptualID allocation and dense ID mapping for entities, predicates, unaries, and attributes.

## Responsibilities
- Intern canonical keys with kind tags.
- Map ConceptualID to dense IDs deterministically.
- Provide reverse lookup for explain/debug.

## Key Interfaces
- `intern(kind, key)`
- `getDenseId(kind, conceptualId)`
- `getConceptualId(kind, denseId)`
- `lookupKey(conceptualId)`

## References
- DS08 for ConceptualID and dense universes.
- DS15 for compiler contract.
