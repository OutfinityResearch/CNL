# Source: OBO Relation Ontology (RO)

- id: `ro`
- downloadedAt: `2026-01-14`
- url: https://purl.obolibrary.org/obo/ro.owl
- retrievedAs: `rdfxml` (via redirect to GitHub raw)
- sourceFile: `ro.owl`
- ttlFile: `ro.ttl`

Notes:
- The PURL redirects to a GitHub snapshot; this repository vendors that snapshot and a Turtle conversion for deterministic imports.

## Description
The OBO Relation Ontology (RO) is a collection of defining relations intended for use across a wide variety of ontologies. It standardizes the "verbs" (object properties) that connect entities.

It defines rigorous logical properties (transitivity, symmetry, inverses) for relations like:
- **Mereology:** `part of`, `has part`.
- **Location:** `located in`, `contained in`.
- **Participation:** `participates in`, `has participant`.
- **Development:** `derives from`, `develops into`.
- **Causality/Interaction:** `regulates`, `negatively regulates`, `positively regulates`.

## Usage in CNL
RO is the standard vocabulary for linking concepts in scientific and engineering domains. Use it to:
- **Precise Modeling:** Avoid ambiguous relationships. Instead of a generic "related to", use "located in" or "derives from".
- **Inference:** The logical definitions in RO allow the CNL engine to perform transitive closure (e.g., if A is part of B and B is part of C, then A is part of C).
- **Cross-Domain Alignment:** Ensure that your relationships map to standard OBO Foundry definitions.