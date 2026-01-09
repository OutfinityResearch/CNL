# dictionary.mjs

## Summary
Compiles BaseDictionary contexts into a dictionary state used for typing, validation, and comparator allowances.

## Responsibilities
- Accept only BaseDictionary contexts.
- Interpret declaration sentences and update dictionary state.
- Emit explicit errors for non-declaration statements.
- Provide lookup helpers used by the compiler.

## Dictionary State
- Predicates: arity, domain, range.
- Attributes: value type, cardinality, comparators.
- Types: optional parent references.

## Key Interfaces
- `applyDictionaryContext(astContext, dictState)`
- `getPredicateDef(key)`
- `getAttributeDef(key)`
- `getTypeDef(key)`

## References
- DS13 for BaseDictionary declarations.
- DS15 for compiler contract.
