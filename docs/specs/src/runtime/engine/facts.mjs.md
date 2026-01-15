# src/runtime/engine/facts.mjs

## Purpose
Formats internal Fact IDs into human-readable sentences.

## Responsibilities
- Decode `FactID` (unary, binary, numeric, attribute).
- Look up entity and predicate names via `idStore`.
- Construct English sentences ("X is a Y", "X relates to Y").

## Key Interfaces
- `formatFactId(factId, state, store)`
- `formatUnaryFact`, `formatBinaryFact`

## References
- DS18 for Trace formatting.
