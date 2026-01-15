# src/runtime/engine/evaluate.mjs

## Purpose
Evaluates boolean conditions against the KB state.

## Responsibilities
- Recursively evaluate `AndChain`, `OrChain`, `CaseScope`, etc.
- Dispatch atomic assertions to `compileCondition` -> `executeSet`.
- Handle Universal Quantification ("Every X is Y") by set difference check (`Base \ Satisfy == Empty`).

## Key Interfaces
- `evaluateCondition(condition, state)`: Returns `true` or `false`.

## References
- DS11 for reasoning primitives.
- DS16 for plan execution.
