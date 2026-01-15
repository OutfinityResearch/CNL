# W3C PROV-O

This ontology is vendored locally to avoid runtime network dependencies.

Expected download URL (content negotiation to Turtle):
- `https://www.w3.org/ns/prov-o`

## Description
The PROV Ontology (PROV-O) expresses the PROV Data Model using the OWL2 Web Ontology Language. It provides a set of classes, properties, and restrictions that can be used to represent and interchange provenance information generated in different systems and under different contexts.

Key concepts:
- **Entity:** A physical, digital, conceptual, or other kind of thing with some fixed aspects.
- **Activity:** Something that occurs over a period of time and acts upon or with entities.
- **Agent:** Something that bears some form of responsibility for an activity taking place.
- **Relations:** `wasGeneratedBy`, `used`, `wasAttributedTo`, `wasDerivedFrom`, `actedOnBehalfOf`.

## Usage in CNL
PROV-O is the standard for tracking lineage and responsibility:
- **Audit Trails:** Who modified this record and when?
- **Scientific Reproducibility:** What data and software produced this result?
- **Supply Chain:** Where did this component come from?
- **Information Quality:** assessing trust based on the source of information.