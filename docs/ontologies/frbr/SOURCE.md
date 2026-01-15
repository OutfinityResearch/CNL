# Source: FRBR (Functional Requirements for Bibliographic Records)

- id: `frbr`
- downloadedAt: `2026-01-13`
- url: http://purl.org/vocab/frbr/core#
- retrievedAs: `rdfxml`
- file: `frbr.rdf`
- ttlFile: `frbr.ttl`

Notes:
- The source is the RDF/XML encoding of the FRBR Core concepts.

## Description
FRBR is a conceptual entity-relationship model developed by the International Federation of Library Associations and Institutions (IFLA). It is the standard for bibliographic data.

It defines four levels of representation for intellectual products:
1.  **Work:** A distinct intellectual or artistic creation (e.g., "Hamlet" the play).
2.  **Expression:** The intellectual or artistic realization of a work (e.g., the English text of Hamlet, or a specific translation).
3.  **Manifestation:** The physical embodiment of an expression (e.g., the 2004 Penguin Classics paperback edition).
4.  **Item:** A single exemplar of a manifestation (e.g., the specific copy on your bookshelf).

## Usage in CNL
Use FRBR when you need to model intellectual property, versioning, or media assets with precision:
- **Library & Archival:** Managing complex catalogs where multiple versions/translations exist.
- **Digital Asset Management:** Tracking the lifecycle of content from concept to file to physical print.
- **Provenance:** Distinguishing between referencing a general work and citing a specific edition.
