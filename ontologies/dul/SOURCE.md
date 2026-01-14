# Source: DOLCE+DnS Ultra Lite (DUL)

- id: `dul`
- downloadedAt: `2026-01-14`
- url: http://www.ontologydesignpatterns.org/ont/dul/DUL.owl
- retrievedAs: `turtle` (server returned Turtle for `.owl`)
- file: `dul.ttl`

Notes:
- HTTPS to `ontologydesignpatterns.org` timed out from this environment; HTTP succeeded.

## Description
DOLCE+DnS Ultra Lite (DUL) is a lightweight upper ontology that simplifies the DOLCE (Descriptive Ontology for Linguistic and Cognitive Engineering) and DnS (Descriptions and Situations) ontologies. It provides a framework for modeling both physical and social reality.

Key concepts include:
- **Objects and Events:** Standard physical entities and processes.
- **Descriptions and Situations:** A powerful pattern for modeling "social reality". A Description (e.g., a Plan, a Law, a Diagnosis) defines concepts that classify entities in a specific Situation (e.g., an execution of a plan, a legal case, a clinical observation).
- **Information Objects:** Distinct from the physical carriers that hold them.
- **Social Agents:** Organizations, collectives, and defined roles.

## Usage in CNL
DUL is ideal for complex domains involving human intent, social structures, and interpretation:
- **Contextual Modeling:** When an entity plays different roles in different contexts (e.g., a person is a "Student" in a "University" context but a "Patient" in a "Hospital" context).
- **Planning and Norms:** Describing rules, plans, or guidelines and checking if actual situations satisfy them.
- **Social Systems:** Modeling organizations, memberships, and socially constructed entities.