# src/runtime/engine/plan.mjs

## Purpose
Implements the AI Planner (GOAP-style) for the `Plan` command.

## Responsibilities
- Compile `ActionBlock` definitions into executable preconditions/effects.
- Perform Breadth-First Search (BFS) over the state space.
- Apply actions to cloned KB states to generate successors.
- Return a `PlanResult` with the sequence of steps and a proof trace.

## Key Interfaces
- `planWithActions(command, state)`: Main entry point.

## Search Strategy
- Forward state-space search.
- Limits depth (max 6) and expanded nodes (max 200) to ensure termination.
- Checks `evaluateCondition` for the goal state at each step.

## References
- DS19 for Planning specification.
