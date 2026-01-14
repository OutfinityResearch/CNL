# Source: Basic Formal Ontology (BFO)

- id: `bfo`
- downloadedAt: `2026-01-14`
- url: https://purl.obolibrary.org/obo/bfo.owl
- retrievedAs: `rdfxml` (via redirect to GitHub raw)
- sourceFile: `bfo.owl`
- ttlFile: `bfo.ttl`

Notes:
- The PURL redirects to a versioned GitHub snapshot; this repository vendors that snapshot and a Turtle conversion for deterministic imports.

## Description
The Basic Formal Ontology (BFO) is a top-level ontology designed to support the integration of data across scientific domains. It provides a small, rigorous core of universally applicable terms and definitions.

BFO distinguishes between two main categories of entities:
- **Continuants:** Entities that persist through time and maintain their identity (e.g., objects, qualities, spatial regions). They exist in full at any time they exist.
- **Occurrents:** Entities that unfold or happen in time (e.g., processes, temporal regions). They have temporal parts.

## Usage in CNL
Use BFO when you need a rigorous metaphysical foundation for your domain model. It is particularly useful for:
- **Scientific Modeling:** Distinguishing between physical objects and the processes they participate in.
- **Data Integration:** Providing a common upper-level structure to align disparate domain ontologies.
- **Time-Dependent Analysis:** Clearly separating things that exist (continuants) from things that happen (occurrents), enabling precise temporal reasoning.

BFO is often the starting point for building robust domain ontologies in biomedicine, engineering, and defense.