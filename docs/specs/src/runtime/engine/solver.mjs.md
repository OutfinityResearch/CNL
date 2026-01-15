# src/runtime/engine/solver.mjs

## Purpose
Implements the Constraint Satisfaction Problem (CSP) solver for the `Solve` command.

## Responsibilities
- Convert AST constraints into a domain-propagation model (`unary` and `binary` constraints).
- Perform arc consistency (AC-3 style) to prune domains (`propagateDomains`).
- Execute backtracking search for variable assignment (`search`).
- Generate `SolveResult` with bindings and proof traces.
- Support `groundChecks` for variable-free constraints within a solve block.

## Key Interfaces
- `solveWithVariables(command, state)`: The main entry point.
- `buildSolveConstraints(condition, state)`: Parses the AST into solver constraints.
- `propagateDomains(domains, constraints, kbState)`: Core pruning logic.

## Limitations
- Only supports conjunctions (AND); disjunctions (OR) in constraints are not supported in V1.
- Negation is supported only for unary constraints.

## References
- DS21 for Constraint Solving.
