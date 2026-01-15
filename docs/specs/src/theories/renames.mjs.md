# src/theories/renames.mjs

## Purpose
Applies load-time vocabulary renaming to the AST.

## Responsibilities
- Rewrites AST nodes (Name, StringLiteral, NounPhrase core) based on a rename map.
- Handles context-sensitive renaming (e.g., renaming a string literal only when it appears in a `BaseDictionary` type declaration).
- Supports renaming types and binary predicates.

## Key Interfaces
- `applyLoadTimeRenames(program, options)`: Mutates the AST in-place and returns applied diagnostics.

## Scope
- **Declarations:** "X is a type" -> "Y is a type".
- **Usage:** "Every X is a Z" -> "Every Y is a Z".
- **Relations:** "domain of P is X" -> "domain of Q is Y".

## References
- DS25 for Vocabulary Renames.
