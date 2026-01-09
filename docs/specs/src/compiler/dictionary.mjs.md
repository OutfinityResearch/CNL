# dictionary.mjs

## Summary
Compiles BaseDictionary contexts into a dictionary state used for typing, validation, and comparator allowances.

## Responsibilities
- Accept only BaseDictionary contexts.
- Interpret declaration sentences and update dictionary state.
- Emit explicit errors for non-declaration statements.
- Provide lookup helpers used by the compiler.
- Normalize binary predicate keys so they match compiled verb phrase keys.

## Dictionary State
- Predicates: arity, domain, range.
- Attributes: value type, cardinality, comparators.
- Types: optional parent references.

## Predicate Key Normalization
- Binary predicate keys are normalized by trimming whitespace, removing a leading `passive:` prefix, and replacing internal spaces with `|`.
- Unary predicate keys are stored as-is (trimmed) to match unary complement keys.

## Key Interfaces
- `applyDictionaryContext(astContext, dictState)`
- `getPredicateDef(key)`
- `getAttributeDef(key)`
- `getTypeDef(key)`

## References
- DS13 for BaseDictionary declarations.
- DS15 for compiler contract.
