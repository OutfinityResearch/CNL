# src/runtime/engine/simulate.mjs

## Purpose
Implements the discrete event simulator for the `Simulate` command.

## Responsibilities
- Iterate for a fixed number of `steps`.
- In each step, evaluate `TransitionRule` triggers ("When X occurs, then Y").
- Apply effects of triggered rules to the KB state.
- Record state snapshots and rule firings for the proof trace.

## Key Interfaces
- `simulateTransitions(command, state)`: Main entry point.

## Logic
- Transitions are evaluated against the *current* state.
- Effects are applied to the *next* state (synchronous update).
- Supports only ground rules in V1.

## References
- DS20 for Simulation specification.
