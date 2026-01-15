# src/runtime/engine/materialize.mjs

## Purpose
Provides rule materialization (forward chaining).

## Responsibilities
- Invoke `ruleStore.applyRules` to compute derived facts.
- Typically called before query execution to ensure the KB is up-to-date.

## Key Interfaces
- `materializeRules(state, options)`

## References
- DS11 for Reasoning.
