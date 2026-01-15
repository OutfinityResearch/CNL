# DS24 - Theory Consistency Checks (Issues, Warnings, Errors)

## Summary
Defines a stable taxonomy for *theory issues* produced by:
- the compiler dictionary validator (`src/compiler/dictionary.mjs`)
- the shared theory diagnostics module (`src/theories/diagnostics.mjs`)
- the static checker CLI (`tools/check-theories.mjs`)
- CNLSession base loading (`src/session/cnl-session.mjs`)
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
- `LoadTimeRenameApplied` (warning)
  - Session (and `checkTheories`) applied one or more directive-based load-time renames (DS25).
- `LoadTimeRenameConflict` (error)
  - The same `from` key is mapped to multiple `to` keys within a loaded bundle (DS25).
  - This makes the bundle non-deterministic and must be fixed by editing the rename directives.

### Rule/KB-level
- `DuplicateRule` (warning)
  - Rule store reports redundant duplicates.
- `ContradictoryAssertion` (error)
  - An explicit positive assertion and its explicit negation are both present:
    - unary: `X is P.` and `X is not P.`
    - binary: `X V Y.` and `X does not V Y.`
  - Bundles/sessions that choose “reject contradictions” must fail transactional load when this is detected.

### Static Theory Checker (`tools/check-theories.mjs`)
The checker reports file-level issues such as:
- `FILE_NOT_FOUND` (error)
- `PARSE_ERROR` (error)
- `COMPILE_ERROR` (error)
- `LOAD_ERROR` (error)

### Cross-ontology duplicates (`src/theories/diagnostics.mjs`)
The shared diagnostics module detects when multiple loaded ontologies emit the same surface form.

Duplicate kinds (warning):
- `DuplicateTypeDeclaration`
  - Same type key appears in more than one loaded file.
- `DuplicatePredicateDeclaration`
  - Same binary predicate key appears in more than one loaded file.

Conflict kinds (warning):
- `DuplicateTypeDifferentParents`
  - Same type key is declared in multiple files with different subtype parents.
- `DuplicatePredicateDifferentConstraints`
  - Same binary predicate key is declared in multiple files with different `domain` / `range` sets.

Note: duplicates are *idempotent at runtime* (the dictionary is deterministic), but they still indicate vocabulary overlap that can hide ontology mismatches. For consistency across tools, sessions and `checkTheories` report both duplicates and conflicts; Explorer groups them by issue kind (DS17).

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

## Tooling Guide: `tools/check-theories.mjs`

The `check-theories.mjs` script is the primary CI/CD gatekeeper for theory bundle integrity. It expands the load graph, compiles the resulting program, and performs cross-ontology consistency checks.

### Usage
```bash
node tools/check-theories.mjs -e theories/base.formal.cnl
```

### Troubleshooting & Fixes

Below is a detailed guide for every error and warning emitted by the tool.

#### Critical Errors (Must Fix)

| Issue Kind | Explanation | Consequence | How to Fix |
| :--- | :--- | :--- | :--- |
| **FILE_NOT_FOUND** | A file referenced in a `Load:` directive does not exist. | The bundle is incomplete; compilation fails immediately. | Check the path in the `Load:` directive. Paths are relative to the project root. |
| **LOAD_ERROR** | Cyclic dependency (A loads B, B loads A) or path outside project root. | Infinite recursion or security violation. | Remove the cycle in the `Load:` graph. Use `Load:` only for strictly hierarchical dependencies. |
| **PARSE_ERROR** | Invalid CNL syntax in a source file. | The compiler cannot build the AST. | Run the parser locally on the specific file to identify the line/column syntax error (DS03). |
| **COMPILE_ERROR** | Semantic error (e.g., using an undefined predicate in a rule). | The Knowledge Base cannot be initialized. | Fix the logic in the CNL file. Ensure all predicates are defined in the dictionary before use. |
| **LoadTimeRenameConflict** | A `RenameType` or `RenamePredicate` directive maps one source key to *multiple* target keys. | Non-deterministic vocabulary; the compiler doesn't know which name to use. | Edit the rename directives so that each source key maps to exactly one target key. |
| **TypeBinaryPredicateConflict** | The same key (e.g., "group") is defined as a `type` AND a `binary predicate`. | **Severe Ambiguity.** Sentences like "group X" could mean "X is a group" (unary) or "group X [missing arg]" (binary). | **Rename one of them.** Use `RenamePredicate: "group" -> "group_rel"` in the loading file, or edit the source ontology. |

#### Warnings (Should Fix)

| Issue Kind | Explanation | Consequence | How to Fix |
| :--- | :--- | :--- | :--- |
| **AmbiguousPredicateArity** | A predicate is used/declared as both unary and binary (e.g., "runs" and "runs fast"). | Parser confusion; may lead to incorrect sentence parsing. | Standardize on one arity or use distinct names (e.g., "runs" vs "executes"). |
| **AmbiguousTypeParent** | A type is declared subtypes of multiple parents (e.g., `Dog < Animal`, `Dog < Pet`). | Not an error in CNL, but can complicate taxonomy visualization. | Verify if this is intentional. If not, choose the most specific parent. |
| **DuplicateTypeDeclaration** | The same type is defined in multiple loaded files. | **Benign.** The compiler merges them. | If definitions differ (descriptions), check for conflicts. Otherwise, ignore. |
| **DuplicatePredicateDeclaration** | The same binary predicate is defined in multiple loaded files. | **Benign.** The compiler merges them. | If constraints differ, see *DuplicatePredicateDifferentConstraints*. |
| **DuplicateTypeDifferentParents** | A type has different parents in different files (e.g., `A < B` in file 1, `A < C` in file 2). | **Semantic Confusion.** The resulting type `A` will inherit from BOTH `B` and `C`. | Create an alignment theory or rename one of the types if they are actually different concepts. |
| **DuplicatePredicateDifferentConstraints** | A predicate has different `domain` or `range` in different files. | **Constraint Violation.** The runtime enforces the *union* or *intersection* of constraints (depending on impl), often blocking valid data. | **Harmonize constraints.** Ensure imported ontologies agree on the schema. Use renames if concepts diverge. |
| **DuplicateRule** | Identical logic rules found in multiple files. | Performance penalty (redundant processing). | Remove the duplicate rule from one of the files or refactor the common logic into a shared base. |
| **LoadTimeRenameApplied** | Informational: Renames were applied during load. | None (as long as intentional). | Verify the resulting vocabulary matches expectations. |

## References
- DS07 for `severity` semantics and error object shape.
- DS22 for ontology import scope and naming strategy.
- DS17 for KB Explorer presentation rules.
- DS12 for session load behavior and diagnostics attachment.
- DS25 for vocabulary renames policy.
