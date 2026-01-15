# src/theories/diagnostics.mjs

## Purpose
Provides static analysis and diagnostics for theory bundles.

## Responsibilities
- **Load Expansion:** Recursively resolve `Load:` directives into a flat list of files (`expandTheoryEntrypoint`).
- **Directives:** Extract `RenameType` and `RenamePredicate` directives (`extractLoadTimeRenames`).
- **Cross-Ontology Checks:** Detect duplicate type/predicate definitions and semantic conflicts (`analyzeCrossOntologyDuplicates`).
- **Preprocessor:** Strip directives from source text before parsing.

## Key Interfaces
- `expandTheoryEntrypoint(entrypoint, options)`
- `extractLoadTimeRenames(files)`
- `analyzeCrossOntologyDuplicates(files, options)`

## Diagnostics Taxonomy
See DS24 for the full list of errors and warnings (e.g., `TypeBinaryPredicateConflict`, `DuplicateTypeDifferentParents`).

## References
- DS24 for Theory Consistency.
- DS25 for Renames.
