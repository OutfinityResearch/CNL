# src/runtime/engine/explain.mjs

## Purpose
Implements the `Explain` command by traversing the justification graph (provenance).

## Responsibilities
- Retrieve the `FactID` for a given assertion.
- Recursively walk the `Justification` DAG stored in `provenance/justifications.mjs`.
- Render a human-readable derivation trace.
- Collect base premises (axioms/facts).

## Key Interfaces
- `explainAssertion(assertion, state)`: Returns `ExplainResult`.

## Logic
- Identifies the ground fact corresponding to the query.
- Uses `renderDerivation` to build the step-by-step proof.

## References
- DS11 for Explain.
- DS18 for Proof Traces.
