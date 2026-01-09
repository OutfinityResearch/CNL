# execute.mjs

## Summary
Executes Plan IR against a compiled KB and produces bitsets, booleans, or numbers.

## Responsibilities
- Evaluate SetPlan and RelationPlan nodes using KB indices.
- Apply numeric and entity-attribute filters.
- Evaluate NumberPlan aggregates (NumberOf, SumOf, AverageOf, TotalOf).

## Key Interfaces
- `executeSet(plan, kb)`
- `executeRelation(plan, kb)`
- `executeBool(plan, kb)`
- `executeNumber(plan, kb)`

## References
- DS11 for reasoning primitives.
- DS16 for Plan IR.
