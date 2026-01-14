# Source: Science Mini (Custom)

- id: `science-mini`
- created: `2026-01-14`
- status: `example`
- file: `science.ttl`

## Description
This is a minimal, custom ontology created for testing and demonstration purposes within the CNL project. It defines a basic hierarchy of physical scientific concepts.

Concepts:
- **PhysicalObject:** The root for tangible things.
- **Substance:** Matter that constitutes objects.
- **Molecule / Atom / Element:** Basic chemical building blocks.
- **Relations:** `partOf`, `contains`, `interactsWith`, `composedOf`.

## Usage in CNL
Use this ontology for:
- **Unit Testing:** verifying that the system can load and reason over a simple hierarchy without the overhead of a full scientific ontology.
- **Tutorials:** Explaining basic inheritance and composition rules to users.
- **Prototyping:** A lightweight placeholder before importing a heavy ontology like ChEBI or GO.
