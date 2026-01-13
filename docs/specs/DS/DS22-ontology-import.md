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

If the resulting predicate verb would collide with a CNL keyword, the importer falls back to a single hyphenated verb token (to keep the generated theory parseable).

OWL-style `hasX` property names are mapped to a single hyphenated verb token (example: `has-beginning`) to avoid the reserved CNL keyword `has` (which is used for attributes).

Predicate phrase constraints:
- Multi-word predicates are emitted only when they match a conservative pattern that the CNL condition grammar accepts (e.g. passive `related to`, active `believes in`).
- Otherwise, the predicate is collapsed into a single hyphenated token (example: `in-date-time-description`) to ensure imported rules remain parseable.

## Output Layout (Generated + Extra)
For an output directory `theories/semantic-web/<id>/`, the importer writes:
- `00-dictionary.generated.cnl` (BaseDictionary context only)
- `00-dictionary.extra.cnl` (BaseDictionary manual additions)
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
