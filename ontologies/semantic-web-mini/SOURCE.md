# Source: Semantic Web Mini (Custom)

- id: `semantic-web-mini`
- created: `2026-01-14`
- status: `example`
- file: `mini.ttl`

## Description
This is a minimal, custom ontology created for testing and demonstration purposes within the CNL project. It focuses on epistemic and agent-based concepts typical of the Semantic Web.

Concepts:
- **Agent / Person:** Entities that can act and hold beliefs.
- **Claim:** A statement or proposition.
- **Relations:** `believes` (Agent -> Claim), `asserts` (Claim -> Domain), temporal ordering (`priorTo`, `subsequentTo`).

## Usage in CNL
Use this ontology for:
- **Reasoning Tests:** Verifying logic about beliefs, assertions, and simple temporal sequences.
- **Demos:** Showing how CNL can model "who said what".
- **Bootstrapping:** Providing a minimal vocabulary for systems that need to track basic agent actions.
