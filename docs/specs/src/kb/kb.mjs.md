# kb.mjs

## Summary
Core compiled KB structures and mutation helpers.

## Responsibilities
- Store relation matrices and inverse matrices.
- Store unary indices and attribute indices.
- Provide insert operations that update forward and inverse indices.

## Key Interfaces
- `insertBinary(subjectId, predId, objectId)`
- `insertUnary(unaryId, subjectId)`
- `setNumeric(attrId, subjectId, value)`
- `insertEntityAttr(attrId, subjectId, entityId)`
- `hasBinary(subjectId, predId, objectId)`

## References
- DS09 for compiled KB representation.
- DS15 for compiler contract.
