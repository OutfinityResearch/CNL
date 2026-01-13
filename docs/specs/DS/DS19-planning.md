# DS19 - Planning (Plan v1)

## Summary
Defines the `Plan to achieve ...` pragmatic, the Action Block syntax, and the planner's execution model.

Plan v1 is intentionally small:
- Ground (no variables).
- Bounded breadth-first search.
- Effects add facts (no deletions).
- Proof output is a structured `ProofTrace` (DS18) of mode `PlanSearch`.

## Scope
- Action Blocks (`Action:`, `Agent:`, `Precondition:`, `Effect:`).
- Planner search strategy and limits.
- How preconditions/effects are evaluated and applied.
- Proof/trace requirements for KB Explorer and evals.

## Action Blocks
Actions are declared in the source as Action Blocks:

```cnl
Action: deliver package.
Agent: a robot.
Precondition: Robot_1 carries Package_A.
Effect: Package_A is delivered.
```

### Constraints
- Preconditions MUST be ground conditions (no variables).
- Effects MUST be ground sentences (no variables).
- Preconditions may use negation (`it is not the case that ...`) but this is evaluated as "not derivable" in the current state.

## Execution Model
The planner treats the current compiled KB as the initial state.

### Preconditions
Each precondition is a `Condition` node (DS03) evaluated with `evaluateCondition` against the current state.

### Effects
Each effect is a `Sentence` node (DS03) applied to a cloned KB state using the runtime effect applicator.

Plan v1 effects:
- Add unary membership (`X is delivered.` / `X is a user.`).
- Add binary relations (`X carries Y.` / `X is located at Y.`).
- Add attribute facts (numeric / entity-valued) when supported by the effect applicator.

## Search Strategy (Plan v1)
- Strategy: breadth-first search (BFS).
- Depth limit: 6.
- Node limit: 200.
- Goal test: evaluate the goal condition against each successor state.

### Result Shape
Returns a `PlanResult`:
- `status`: `satisfied` | `unsatisfied`
- `steps`: ordered array of action names (strings)
- `proof`: `ProofTrace` with mode `PlanSearch` (DS18)

## ProofTrace Requirements (PlanSearch)
When a plan is found:
- Include a brief search summary (depth bound, expanded nodes).
- Include the chosen plan steps in order.
- For each step, include the action name and the (original) precondition/effect texts.
- End with a clear conclusion line stating that the goal is satisfied after the final step.

When no plan is found:
- Explain that the bounded search was exhausted (depth limit / node limit).

## Limitations (Intentional)
- No variables in actions/preconditions/effects.
- No effect deletion / retraction.
- No per-step re-materialization of derived facts; planning is best modeled with base facts and direct effects in v1.

## References
- DS03 for Action Block parsing.
- DS10 for compilation and action storage.
- DS18 for proof trace formats.
- DS17 for KB Explorer presentation of plan proofs.

