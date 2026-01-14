# Ontology Import (RDF/RDFS/OWL subset)

This tool converts a conservative subset of Semantic Web ontologies (RDFS + OWL-RL-ish schema facts) into CNL files.

## Goals
- Keep the import deterministic and auditable.
- Do **not** overwrite manual edits: every output has a `.generated.cnl` and a `.extra.cnl` companion.
- If a statement appears in both `.extra.cnl` and the newly generated output, the duplicate is removed from `.extra.cnl` (generated wins).

## Supported input (subset)
- Turtle-like triples (`.ttl`) with:
  - `@prefix` declarations
  - IRI terms as `<...>` or `prefix:local`
  - `a` shorthand for `rdf:type`
  - Basic `;` and `,` expansions
- N-Triples-like lines are also accepted as a subset.

Ignored:
- Blank nodes (`[]`, `_:`), collections, restrictions, complex OWL expressions.
- Literal objects (except `rdfs:label` / `skos:prefLabel`).

Notes:
- Language tags on labels (e.g. `"Interval"@en`) are parsed; English labels are preferred when available.
- Datatype annotations on literals are tolerated but not interpreted.

## Mapped constructs
- Classes: `rdf:type owl:Class` or `rdfs:Class` -> type + unary predicate in BaseDictionary.
- Properties: `rdf:type owl:ObjectProperty` / `owl:DatatypeProperty` / `rdf:Property` -> binary predicate in BaseDictionary.
- `rdfs:subClassOf` -> subtype relation in BaseDictionary.
- `rdfs:domain` / `rdfs:range` -> domain/range constraints in BaseDictionary.
- `rdfs:subPropertyOf` -> rule `If X P Y, then X Q Y.`
- `owl:inverseOf` -> rule `If X P Y, then Y Q X.`
- `owl:TransitiveProperty` -> rule `If X P Y and Y P Z, then X P Z.`
- `owl:SymmetricProperty` -> rule `If X P Y, then Y P X.`

## Naming and parseability
- Types and keys are generated as lowercase hyphenated identifiers.
- Predicates are emitted conservatively to remain parseable by the CNL grammar (examples: `believes in`, `is prior to`).
- `--prefix` is optional and can be used to force namespace-like keys when experimenting with multiple overlapping ontologies.

## Output layout
Given `--out theories/semantic-web/mini`, the tool writes:
- `theories/semantic-web/mini/00-dictionary.generated.cnl`
- `theories/semantic-web/mini/00-dictionary.extra.cnl`
- `theories/semantic-web/mini/01-rules.generated.cnl`
- `theories/semantic-web/mini/01-rules.extra.cnl`

You can freely edit the `.extra.cnl` files. Re-running the tool updates `.generated.cnl` and removes duplicated statements from `.extra.cnl`.

## Usage
```
node tools/ontology-import/import.mjs \
  --in tools/ontology-import/fixtures/mini.ttl \
  --out theories/semantic-web/mini \
  --context MiniOntology
```
