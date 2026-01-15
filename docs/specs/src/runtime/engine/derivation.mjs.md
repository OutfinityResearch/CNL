# src/runtime/engine/derivation.mjs

## Purpose
Renders a recursive derivation tree into a linear list of steps.

## Responsibilities
- Walk the Justification graph from a root fact.
- Render applied rules (using `renderRuleSummary`).
- Output "Therefore: ..." steps.
- Limit recursion depth to prevent infinite loops (though justifications should be DAGs).

## Key Interfaces
- `renderDerivation(rootFactId, state, store, options)`

## References
- DS18 for Proof Traces.
