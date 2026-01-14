# DS24 - Theory Consistency Checks (Issues, Warnings, Errors)

## Summary
Defines a stable taxonomy for *theory issues* produced by:
- the compiler dictionary validator (`src/compiler/dictionary.mjs`)
- the static checker (`tools/check-theories.mjs`)
- the KB Explorer UI (`tools/explorer/*`)

The goal is to keep theory problems actionable, deterministic, and consistently presented across tools.

## Terminology
- **Issue**: a diagnostic item about a theory, with `severity: "error" | "warning"`.
- **Error**: an issue that indicates a likely semantic ambiguity or structural inconsistency that should be fixed (rendered in red).
- **Warning**: an issue that is not necessarily fatal but is suspicious or reduces clarity (rendered in yellow).

## Standard Issue Object
Issue objects follow DS07 conventions (same `severity` field), with additional fields used by tooling:

```json
{
  "kind": "TypeBinaryPredicateConflict",
  "severity": "error",
  "message": "Dictionary key 'year' is declared both as a type and as a binary predicate.",
  "key": "year",
  "file": "theories/ontologies/w3c-owl-time/00-dictionary.generated.cnl",
  "line": 131,
  "hint": "Rename one of the declarations or resolve the ontology collision at import time."
}
```

Required fields:
- `kind`: stable taxonomy label (string).
- `severity`: `error` or `warning`.
- `message`: human-readable description.

Optional fields:
- `key`: the relevant concept/term/token.
- `file`, `line`: source location (when available).
- `hint`: short fix suggestion.
- `details`: tool-specific raw structure (for Developer View).

## Taxonomy (Initial)
This list is intentionally small and can grow over time, but existing `kind` strings must stay stable.

### Dictionary / CNL-level
- `TypeBinaryPredicateConflict` (error)
  - Same dictionary key is both a type (unary concept) and a binary predicate.
  - Typical cause: an OWL term used as both `owl:Class` and `rdf:Property`.
- `AmbiguousPredicateArity` (warning)
  - Predicate declared both unary and binary.
- `AmbiguousTypeParent` (warning)
  - Type declared with multiple parents.

### Rule/KB-level
- `DuplicateRule` (warning)
  - Rule store reports redundant duplicates.

### Static Theory Checker (`tools/check-theories.mjs`)
The checker reports file-level issues such as:
- `FILE_NOT_FOUND` (error)
- `PARSE_ERROR` (error)
- `COMPILE_ERROR` (error)
- `CYCLIC_LOAD` (warning)
- `DUPLICATE_TYPE` (warning)
- `DUPLICATE_PREDICATE` (warning)
- `TYPE_PREDICATE_CONFLICT` (warning)
- `REFLEXIVE_SUBTYPE` (warning)
- `CYCLIC_SUBTYPE` (warning)

Note: duplicates are *idempotent at compile time* and are not treated as runtime warnings by default. The checker is the preferred way to audit large imported bundles.

## KB Explorer Grouping Rules
KB Explorer shows issues under the `⚠️ issues` folder (last in the Knowledge Tree).

### Tree grouping
`issues` is grouped as:
1. Severity (`Errors`, `Warnings`)
2. Issue kind (`TypeBinaryPredicateConflict`, `DuplicateRule`, ...)
3. Key / concept / term (fallback: `general`)
4. Leaf issue nodes (full message + raw JSON)

### Cloud colors
- `severity: "error"` → red cloud style
- `severity: "warning"` → yellow cloud style

## Ontology Import Conflict Resolution (P3)
When importing ontologies, the extractor resolves class/property collisions deterministically:
- If an IRI has **property-like signals** (`domain`, `range`, `subPropertyOf`, `inverseOf`, `transitive`, `symmetric`), it is treated as a **property**.
- Otherwise, it is treated as a **class**.

This reduces downstream ambiguity and prevents generating both type and binary predicate declarations for the same key.

Additionally, the renderer resolves **key-level collisions**:
- If a *type key* and a *binary predicate key* normalize to the same CNL key (even for different IRIs),
  the importer keeps only one side to preserve an unambiguous BaseDictionary.

## References
- DS07 for `severity` semantics and error object shape.
- DS22 for ontology import scope and naming strategy.
- DS17 for KB Explorer presentation rules.
