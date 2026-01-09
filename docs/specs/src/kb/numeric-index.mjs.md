# numeric-index.mjs

## Summary
Stores numeric attribute values and supports numeric filtering.

## Responsibilities
- Maintain `values` and `hasValue` bitset.
- Provide `filter(op, value)` to return candidate subjects.
- Optional sorted indices for range queries.

## Key Interfaces
- `setValue(subjectId, value)`
- `filter(comparator, value)`

## References
- DS09 for numeric index structure.
- DS16 for NumFilter semantics.
