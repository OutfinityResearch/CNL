# src/runtime/engine/execute.mjs

## Purpose
The central dispatch point for executing parsed `Command` AST nodes.

## Responsibilities
- Route commands to specific handlers: `solveWithVariables`, `planWithActions`, `simulateTransitions`, etc.
- Handle `Return`, `Verify`, `Find`, `Maximize`, `Minimize`.
- Collect entities and build witness traces for set-based results.
- Enforce variable restrictions (variables only allowed in Solve/Optimize).

## Key Interfaces
- `executeCommandAst(command, state)`: Returns a Result object (`QueryResult`, `SolveResult`, `ProofResult`, etc.).

## References
- DS04 for Command semantics.
- DS15 for Runtime contract.
