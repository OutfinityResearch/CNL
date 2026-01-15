# Source: LKIF-Core (Legal Knowledge Interchange Format)

- id: `lkif-core`
- downloadedAt: `2026-01-14`
- url: https://github.com/RinkeHoekstra/lkif-core
- retrievedAs: `rdfxml` (multiple modules merged)
- file: `lkif-core.ttl`

Notes:
- LKIF-Core is distributed as a set of modular OWL files. The vendored version here represents a merged subset relevant for general legal modeling, specifically the Norm, Action, Expression, and Role modules.

## Description
LKIF-Core is a library of ontologies developed for the legal domain. It provides a vocabulary for describing legal concepts, norms, and the social actions that create or modify them.

Key concepts:
- **Norms:** Obligations, Permissions, Prohibitions, Rights, Powers.
- **Legal Actions:** Public acts, decisions, mandates, delegations.
- **Legal Roles:** Agents playing roles in legal contexts (e.g., Legislative Body, Natural Person).
- **Expressions:** The distinction between a medium (Document) and the Proposition it bears.

## Usage in CNL
LKIF-Core provides the semantic backing for "Law as Code" and compliance systems:
- **Regulatory Compliance:** Modeling laws and regulations to check if business processes adhere to them.
- **Contract Modeling:** Defining rights, duties, and powers within a contract.
- **Legal Reasoning:** Inferring whether a specific action constitutes a violation or a valid exercise of power.
