# store.mjs

## Summary
Stores RulePlan artifacts and supports delta-based execution.

## Responsibilities
- Register RulePlans with IDs.
- Track rule metadata and dependencies.
- Provide iteration over rules for forward chaining.
- Apply RulePlans to a KB and return the count of newly inserted facts.

## Key Interfaces
- `addRule(plan)`
- `getRules()`
- `applyRules(kbApi, options)`

## References
- DS11 for deduction flow.
- DS15 for compiler output.
