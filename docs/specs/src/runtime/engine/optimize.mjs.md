# src/runtime/engine/optimize.mjs

## Purpose
Evaluates optimization objectives (Maximize/Minimize) and aggregations (Sum/Count).

## Responsibilities
- Evaluate `NumberOf`, `SumOf`, `AverageOf`, `TotalOf` expressions.
- Dispatch to `executeNumber` plan operator.
- Support aggregations over filtered sets.

## Key Interfaces
- `evaluateAggregation(expr, state)`: Returns a number.

## References
- DS23 for Optimization.
