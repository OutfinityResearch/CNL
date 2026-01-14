# DS22 - Ontology Import (RDF/RDFS/OWL Subset)

## Summary
Defines a deterministic, audit-friendly import path from a conservative subset of Semantic Web ontologies (RDFS + selected OWL-RL schema constructs) into CNL-PL.

The output is split into:
- **Generated** CNL files (overwritten on every import)
- **Extra** CNL files (manual additions preserved across regenerations)

If a statement appears in both Generated and Extra, the duplicate is removed from Extra (Generated wins).

## Scope
- Supported input formats and accepted ontology subset.
- Stable naming strategy from IRIs to CNL keys.
- Output file layout and regeneration rules.
- Deduplication semantics between `.generated.cnl` and `.extra.cnl`.

## Goals
- Keep import deterministic: same ontology snapshot -> identical generated files.
- Avoid runtime network dependencies: imported ontology files are local inputs; no fetching at runtime.
- Keep the result auditable and editable: generated output is machine-owned, extras are human-owned.

## Non-Goals
- Full OWL semantics (open-world reasoning, existentials, restrictions).
- Blank-node-heavy parsing and complex Turtle features.
- Importing individuals as ground facts by default.

## Supported Inputs
The importer accepts Turtle-like triples (`.ttl`) and a N-Triples-like subset:
- `@prefix` declarations
- IRI terms as `<...>` or `prefix:local`
- `a` shorthand for `rdf:type`
- Basic `;` and `,` expansions

Ignored:
- blank nodes (`[]`, `_:`)
- complex OWL expressions (restrictions, unionOf, intersectionOf, etc.)
- literal objects (except labels)

Notes:
- Language tags on literals (e.g. `"Label"@en`) are parsed and used for label selection.
- Datatype annotations on literals (e.g. `"3"^^xsd:int`) are tolerated but not interpreted.
- Triple-quoted literals (`"""..."""`) are tolerated so that OBO-style definitions/comments do not block label extraction.
- `#` comments are ignored by the tokenizer (outside of literals/IRIs), to avoid corrupting multi-line literals that contain `#`.

## Supported Ontology Constructs (Subset)
### Vocabulary
- `owl:Class` and `rdfs:Class` -> BaseDictionary type + unary predicate
- `owl:ObjectProperty`, `owl:DatatypeProperty`, `rdf:Property` -> BaseDictionary binary predicate
- `rdfs:domain`, `rdfs:range` -> BaseDictionary domain/range constraints
- `rdfs:subClassOf` -> BaseDictionary subtype relations

### Schema Rules
These compile to CNL `Rule:` statements using DS10 placeholder templates:
- `rdfs:subPropertyOf(P, Q)` -> `Rule: If X P Y, then X Q Y.`
- `owl:inverseOf(P, Q)` -> `Rule: If X P Y, then Y Q X.`
- `owl:TransitiveProperty(P)` -> `Rule: If X P Y and Y P Z, then X P Z.`
- `owl:SymmetricProperty(P)` -> `Rule: If X P Y, then Y P X.`

## Naming Strategy
IRIs are mapped to stable CNL keys:
- **Types / unary predicates**: lowercase, hyphenated compounds (DS03 naming conventions).
- **Binary predicates**: lowercase verb phrases; may include particles.

The importer may use `rdfs:label` / `skos:prefLabel` when present; otherwise it falls back to the IRI local name.

Label preference rules:
- Prefer English labels (`@en`, `@en-*`) when available.
- Otherwise, prefer untagged labels.
- Otherwise, fall back to the IRI local name.

Non-English language-tagged labels are **ignored** (never selected), to avoid importing vocabulary that violates the repo-wide "English-only" rule.

Additional label sources (lower priority than `rdfs:label` / `skos:prefLabel`):
- `oboInOwl:hasExactSynonym`
- `IAO:0000111` (editor preferred term)

If the resulting predicate verb would collide with a CNL keyword, the importer falls back to a single hyphenated verb token (to keep the generated theory parseable).

OWL-style `hasX` property names are mapped to a single hyphenated verb token (example: `has-beginning`) to avoid the reserved CNL keyword `has` (which is used for attributes).

Predicate phrase constraints:
- Multi-word predicates are emitted only when they match a conservative pattern that the CNL condition grammar accepts (e.g. passive `related to`, active `believes in`).
- Otherwise, the predicate is collapsed into a single hyphenated token (example: `in-date-time-description`) to ensure imported rules remain parseable.

## Output Layout (Generated + Extra)
For an output directory `theories/semantic-web/<id>/`, the importer writes:
- `00-dictionary.generated.cnl` (BaseDictionary context only)
- `00-dictionary.extra.cnl` (BaseDictionary manual additions)
- `00-dictionary.unlabeled.generated.cnl` (audit-only list of dropped opaque-ID terms, written only when needed)
- `01-rules.generated.cnl` (schema rules in a chosen context)
- `01-rules.extra.cnl` (manual schema rules in a separate `...Extra` context)

## Project Workflow (Vendored Ontologies)
Ontology sources should be stored in-repo under:
- `ontologies/`

Each subfolder contains one or more `.ttl` files:
- `ontologies/<id>/*.ttl`

To regenerate all imported ontologies at once:
- `npm run generateTheories`

This scans `ontologies/*/*.ttl` and runs the importer for each folder.

### Base Loading
The recommended workflow is to keep session autoload simple:
- `theories/base.cnl` is the single base entrypoint.
- It may include `Load: "theories/ontologies/<id>/..."` directives to pull in selected vendored ontologies.

## Deduplication Semantics
On regeneration:
- `.generated.cnl` is rewritten completely.
- `.extra.cnl` is preserved, but single-line statements that match generated statements are removed.
- Context directives and comments are preserved in `.extra.cnl`.

## Subtype Edge Normalization
The importer normalizes subtype edges before emitting them:
- Reflexive edges (`"X" is a subtype of "X".`) are dropped.
- Duplicate identical edges are deduplicated.
- Cycles in the subtype graph are broken deterministically (edges that would introduce a cycle are dropped).
- Obvious metamodel leaks are filtered: abstract OWL/RDFS metaclasses like `"restriction"`, `"class"`, `"type"` are not allowed to become subtypes of concrete domain types.

## Opaque-ID Term Policy
Some ontologies contain IRIs that encode opaque identifiers (e.g. `CHEBI_50906`, `COB_0000121`), and some of those IRIs do not provide any English label.

To keep generated CNL readable by default:
- If a term has **no English label** and its derived key looks like an opaque ID (`term-<hash>` or `bfo-000...` / `ro-000...` / `chebi-...` / `cob-...` / etc), it is **dropped** from the generated dictionary.
- Dropped terms are recorded in `00-dictionary.unlabeled.generated.cnl` (audit-only; not loaded by base bundles).

## Cross-Ontology Key Conflicts
Multiple ontologies may reuse the same English surface form for different kinds (type vs binary predicate).
To keep bundle loading deterministic and unambiguous:
- The importer may apply deterministic, ontology-scoped renames for a small set of known conflict keys (example: `prov-entity`, `foaf-image`).
- Renames are applied during generation so that both dictionary and rules remain consistent.

## Implementation Reference
- Tool entrypoint: `tools/ontology-import/import.mjs`
- Parser: `tools/ontology-import/lib/turtle.mjs`
- Schema extraction: `tools/ontology-import/lib/extract.mjs`
- Rendering: `tools/ontology-import/lib/render.mjs`
- Extra deduplication: `tools/ontology-import/lib/extra.mjs`

## References
- DS03 for syntax and naming conventions.
- DS10 for placeholder rule templates used by imported schema rules.
- DS13/DS14 for BaseDictionary + base bundle philosophy.
- DS24 for theory consistency checks and ontology collision resolution.
