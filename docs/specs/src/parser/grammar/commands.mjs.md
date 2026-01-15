# src/parser/grammar/commands.mjs

## Purpose
Parses imperative commands (Pragmatics).

## Responsibilities
- Recognize command keywords: `Return`, `Verify`, `Find`, `Solve`, `Maximize`, `Minimize`, `Explain`, `Plan`, `Simulate`.
- Parse specific arguments for each command type (e.g., `Simulate` takes a number of steps).
- Return `Command` AST nodes.

## Key Interfaces
- `parseCommandFromTokens(tokens)`

## Supported Commands
- `ReturnCommand`: Evaluates an expression/set.
- `VerifyCommand`: Checks a proposition.
- `FindCommand`: Searches for entities matching a constraint.
- `SolveCommand`: CSP solver for variables (`?X`).
- `PlanCommand`: Generates actions to achieve a goal.
- `SimulateCommand`: Advances state via transition rules.
- `ExplainCommand`: Returns justification/trace.
- `MaximizeCommand` / `MinimizeCommand`: Optimization.

## References
- DS04 for Pragmatics.
