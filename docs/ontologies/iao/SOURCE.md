# Source: Information Artifact Ontology (IAO)

- id: `iao`
- downloadedAt: `2026-01-14`
- url: https://purl.obolibrary.org/obo/iao.owl
- retrievedAs: `rdfxml` (via redirect to a versioned GitHub snapshot)
- sourceFile: `iao.owl`
- ttlFile: `iao.ttl`

Notes:
- The PURL redirects to a versioned GitHub snapshot; this repository vendors that snapshot and a Turtle conversion for deterministic imports.

## Description
The Information Artifact Ontology (IAO) is dedicated to information entities. It treats information as a dependent continuant—something that is about something else and can be concretized in various ways (digital files, printed pages, mental states).

Key concepts:
- **Information Content Entity:** The abstract information (e.g., a protocol, a dataset, a hypothesis).
- **Directive Information Entity:** Information that specifies actions (e.g., a plan specification, an algorithm).
- **Document Parts:** Textual entities, figures, tables, scatter plots.
- **Metadata:** Authorship, versioning, curation status.

## Usage in CNL
IAO is critical for systems that manage data about data:
- **Scientific Workflows:** Describing protocols, assays, and results.
- **Data Provenance:** Tracking how a dataset was generated and what algorithm was used.
- **Document Analysis:** Modeling the structure and content of reports and papers.