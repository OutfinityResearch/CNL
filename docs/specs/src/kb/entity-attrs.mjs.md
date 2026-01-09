# entity-attrs.mjs

## Summary
Stores entity-valued attributes per subject.

## Responsibilities
- Maintain per-subject bitsets of entity values.
- Support filters that match any value in a target set.
- Optional: expose values for projection into derived binary predicates.

## Key Interfaces
- `addValue(subjectId, entityId)`
- `filter(valueSet)`

## References
- DS09 for entity attribute indices.
- DS16 for AttrEntityFilter semantics.
