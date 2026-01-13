# loader.mjs

## Summary
Loads BaseDictionary and base theory CNL files.

## Responsibilities
- Read CNL files from disk into `{ path, text }` entries.
- Provide a default "base bundle" loader used by `CNLSession` autoload.

## Key Interfaces
- `loadBaseDictionary(paths)`
- `loadBaseTheories(paths)`
- `loadDefaultBaseBundle({ rootDir })`

## Defaults
Default relative paths live in:
- `src/theories/base-defaults.mjs`

## References
- DS13 for BaseDictionary.
- DS14 for base theory layout.
