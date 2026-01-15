# src/runtime/engine/witness-traces.mjs

## Purpose
Builds witness traces for set-based query results.

## Responsibilities
- Explain *why* a particular entity is in the result set.
- Reconstruct the chain of filters (intersection, union, preimage) that led to inclusion.
- Surface the base facts that justify membership.

## Key Interfaces
- `buildWitnessTraceForSet(setPlan, entities, state)`

## Logic
- Recursively traverses the `SetPlan` structure.
- For each operator (e.g., `Intersect`, `Preimage`), checks which branch the entity satisfies.
- Collects `FactIDs` representing the supporting edges in the graph.

## References
- DS18 for Trace formats.
