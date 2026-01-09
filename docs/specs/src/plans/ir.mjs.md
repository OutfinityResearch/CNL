# ir.mjs

## Summary
Defines Plan IR node constructors and type tags for SetPlan, RelationPlan, BoolPlan, and NumberPlan.

## Responsibilities
- Provide stable plan node shapes.
- Ensure plans carry only IDs, not raw text.
- Support serialization for caching or debugging.

## Key Interfaces
- `setPlan(op, args)`
- `relationPlan(op, args)`
- `boolPlan(op, args)`
- `numberPlan(op, args)`

## References
- DS16 for plan operator definitions.
