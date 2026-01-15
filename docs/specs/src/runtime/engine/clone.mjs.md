# src/runtime/engine/clone.mjs

## Purpose
Provides deep cloning capabilities for the Knowledge Base state.

## Responsibilities
- Clone the entire KB structure (relations, inverse relations, unary indices, attribute indices).
- Use efficient bitset cloning.
- Support "forking" the state for simulation and planning lookahead.

## Key Interfaces
- `cloneKbApi(kbApi)`: Returns a new `KB` instance with independent storage but identical content.

## References
- DS20 for Simulation state management.
