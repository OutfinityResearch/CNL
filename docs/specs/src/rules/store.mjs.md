# store.mjs

## Summary
Stores RulePlan artifacts and supports delta-based execution.

## Responsibilities
- Register RulePlans with IDs.
- Track rule metadata and dependencies.
- Provide iteration over rules for forward chaining.

## Key Interfaces
- `addRule(plan)`
- `getRules()`
- `applyRules(kb, executor)`

## References
- DS11 for deduction flow.
- DS15 for compiler output.
