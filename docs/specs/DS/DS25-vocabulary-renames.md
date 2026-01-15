# DS25 - Vocabulary Renames (Generation-Time and Load-Time)

## Summary
Defines when and how the system is allowed to rename vocabulary keys (types and binary predicates) in order to keep the **BaseDictionary unambiguous** and the **user-facing CNL surface deterministic**.

Renames can happen at two stages:
1. **Generation-time** (preferred): during ontology import (`npm run generateTheories`), before CNL is produced.
2. **Load-time** (fallback): during session theory loading, before compilation, for legacy or external theory bundles that cannot be regenerated.

## Goals
- Keep parsing and compilation deterministic: one surface form corresponds to one internal meaning within a session.
- Avoid hidden ambiguity: any rename must be auditable and (ideally) recorded as an issue in the session.
- Keep KB Explorer honest: Explorer displays what exists in the session; it must not invent extra interpretation layers.

## Non-Goals
- Full namespace support in the CNL grammar (that would be a separate language-level change in DS03).
- Automatic synonym expansion during parsing.

## Core Principle
Within a single session:
- A dictionary key is **unique**: `key -> meaning` must be 1:1.
- If two imported sources would introduce different meanings for the same key, one of them must be renamed.

## When Renames Are Required
### R1: Type vs binary predicate conflict (hard)
If the same surface key would be both:
- a **type** (unary concept), and
- a **binary predicate**,
then the bundle becomes ambiguous and must be resolved.

This is treated as a hard issue at dictionary level (DS24):
- `TypeBinaryPredicateConflict` (`severity: "error"`)

Preferred fix: resolve at generation-time (DS22).

### R2: Cross-ontology semantic conflicts (soft but suspicious)
If the same surface key is declared in multiple loaded files and constraints differ, it is suspicious:
- `DuplicatePredicateDifferentConstraints` (domain/range disagree)
- `DuplicateTypeDifferentParents` (subtype parents disagree)

These are `severity: "warning"` by default (DS24), because they may still be consistent, but they reduce clarity.

If such conflicts are deemed “different senses”, the recommended fix is to rename one side (generation-time first).

## Where Renames Occur
### Generation-time renames (preferred)
Generation-time renames are applied in the ontology importer renderer (DS22).

Characteristics:
- The rename is applied consistently across:
  - `00-dictionary.generated.cnl`
  - `01-rules.generated.cnl`
- The output is self-contained: no special runtime transformation required.
- The original surface form is not preserved as a synonym unless explicitly modeled in theory (e.g. via `alternative-label` relations).

Examples (current conventions):
- `w3c-prov-o`: `entity` (binary predicate) -> `prov-entity`
- `w3c-prov-o`: `agent` (binary predicate) -> `prov-agent`
- `foaf`: `image` (binary predicate) -> `foaf-image`
- `foaf`: `given-name` (binary predicate) -> `foaf-given-name`
- `foaf`: `family-name` (binary predicate) -> `foaf-family-name`

### Load-time renames (fallback; must be explicit)
Load-time renames are allowed only when:
- we load external/legacy theory bundles that cannot be regenerated, or
- we must resolve a conflict introduced by user-provided bundles at session load.

Rules:
- Load-time renames must be **explicit and visible in the theory bundle itself**, via directives that live next to the affected theory files.
- Renames must be applied **before compilation** and must rewrite:
  - BaseDictionary declarations, and
  - all usages in rules/facts (verb groups, passive relations, and quoted keys used by dictionary meta-statements like domain/range).

Auditing:
- Applying a load-time rename must produce a session issue (`severity: "warning"`) so Explorer can show that a rewrite occurred.

#### Rename directives (syntax)
Directives are line-oriented and must end with a `.`:
- `RenameType: "<from>" -> "<to>".`
- `RenamePredicate: "<from>" -> "<to>".`

Rules:
- Directives may appear in any loaded file (including the entrypoint); they apply to the entire loaded bundle.
- The same `<from>` key must not be mapped to two different `<to>` keys within a bundle. If it happens, theory loading must report an error issue (DS24) and treat the bundle as suspicious.
- `RenamePredicate` applies to **binary predicates** and operates on predicate surface forms such as `"part of"` (space-separated). The system also rewrites equivalent internal spellings when present (e.g. `part|of`).

## Naming Conventions for Renamed Keys
Renamed keys should remain valid CNL identifiers (DS03) and should be stable.

Recommended patterns:
- **Ontology prefix** (preferred): `<ontologyId>-<key>`
  - examples: `prov-entity`, `foaf-image`
- **Kind suffix** (alternative, verbose): `<key>-binary-predicate`

The ontology prefix is preferred because it scales and remains human-readable.

## Interactions with `checkTheories` and Explorer
- The shared diagnostics module (`src/theories/diagnostics.mjs`) is used by both:
  - session base loading, and
  - `tools/check-theories.mjs`
  to classify duplicates vs conflicts (DS24).
- Explorer shows issues from the session state (DS17/DS24).
- `checkTheories` applies the same directive-based renames as the session, so issues are consistent across tools (DS24).

## Verb Canonicalization and Plural Surface Forms
Binary predicates are canonicalized by lemmatizing the first verb-like token (example: `offers` → `offer`).

Implication:
- A binary predicate declared as `"offers"` will internally behave like `"offer"` for dictionary keys.
- This can introduce a `TypeBinaryPredicateConflict` when there is also a type key `"offer"`.

Recommended practice:
- Use `RenamePredicate` directives to rename the *plural surface form* to a disambiguated key, typically an ontology-prefixed token:
  - `RenamePredicate: "offers" -> "schema-offer".`

## References
- DS03 for identifier constraints.
- DS12 for session base loading.
- DS22 for ontology import behavior.
- DS24 for issue taxonomy and cross-ontology conflict detection.
