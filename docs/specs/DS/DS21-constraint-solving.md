# DS21 - Constraint Solving (Solve v1/v2)

## Summary
Defines the `Solve ... such that ...` pragmatic for variable binding and constraint satisfaction.

Solve supports a restricted, deterministic CSP model over entity domains:
- Conjunctive constraints only (AND).
- No OR branches.
- Negated unary constraints are supported (`it is not the case that ?X is blocked`), but negated binary/attribute constraints are rejected.
- Variables range over entities (`?X`).

Solve v2 adds a search layer (backtracking) on top of domain propagation to ensure returned bindings are supported by at least one consistent assignment.

## Scope
- Constraint shapes accepted by `Solve`.
- Domain propagation (AC-3 style).
- Backtracking search (v2) and how results are projected.
- Proof/trace requirements (`ProofTrace` mode `SolveSearch`).

## Accepted Constraint Forms
Inside `such that ...`, the constraint expression must be a conjunction of atomic conditions:

- Unary membership:
  - `?X is a safe-region`
  - `?X is active`
- Negated unary membership:
  - `it is not the case that ?X is blocked`
- Binary relations:
  - `?X touches ?Y`
  - `Region_A touches ?X`

### Rejected Forms (v1/v2)
- OR (`or`, `either ... or ...`)
- Negated binary/attribute constraints (`it is not the case that ?X touches ?Y`, `it is not the case that ?X has a weight of 10`)
- Variable complements (`?X is ?Y`)

## Domain Propagation (AC-3 Style)
Each variable has a Bitset domain over entities.

For a binary constraint `R(X, Y)`:
- `Xdom := Xdom ∩ preimage(R, Ydom)`
- `Ydom := Ydom ∩ image(R, Xdom)`

Propagation repeats until fixpoint or contradiction (an empty domain).

## Backtracking Search (Solve v2)
Domain propagation is not sufficient to guarantee that all remaining values can co-exist across multiple variables.

Solve v2 performs a bounded backtracking search to enumerate consistent assignments:
- Choose a variable with the smallest remaining domain (>1).
- Try each candidate entity in a deterministic order.
- After each assignment, re-run propagation to prune domains.
- On contradiction, backtrack.

### Projection Semantics
The solver enumerates full assignments, then projects results:
- If the command requests a single variable (e.g., `Solve for ?X ...`), the returned entity list is the set of values of `?X` that appear in at least one solution.
- If multiple variables are requested, the result includes per-variable sets (and may optionally include explicit `solutions` for tooling).

## Result Shape
Returns a `SolveResult`:
- `entities`: returned entity list (when a single variable is requested)
- `bindings`: map from `?Var` to entity lists
- `solutions` (optional): list of partial binding objects for debugging/tooling
- `proof`: `ProofTrace` with mode `SolveSearch` (DS18)

## ProofTrace Requirements (SolveSearch)
The proof trace should make search behavior understandable:
- Show initial domains (truncated).
- Show key decisions:
  - `Try ?R2 = Region_D.`
  - `Backtrack: empty domain for ?R3.`
- Summarize solutions found (count and a few sample bindings).
- Include a `premises` list of witness facts that demonstrate the constraints for shown solutions (e.g., `Region_A touches Region_C.`).

The trace is not expected to be a complete formal proof calculus; it is a deterministic, inspectable explanation of the solver's search and witnesses.

## References
- DS03 for syntax of conditions and variables.
- DS11 for bitset primitives used by propagation.
- DS18 for proof trace formats.
- DS17 for KB Explorer presentation of CSP proofs.
