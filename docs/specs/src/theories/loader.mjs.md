# loader.mjs

## Summary
Loads BaseDictionary and base theory CNL files in a defined order.

## Responsibilities
- Apply BaseDictionary contexts before other theories.
- Load base theory modules in explicit order.
- Report load diagnostics and version info.

## Key Interfaces
- `loadBaseDictionary(paths)`
- `loadBaseTheories(paths)`

## References
- DS13 for BaseDictionary.
- DS14 for base theory layout.
