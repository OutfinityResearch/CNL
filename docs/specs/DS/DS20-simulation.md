# DS20 - Simulation (Simulate v1)

## Summary
Defines the `Simulate N steps.` pragmatic and how transition rules are applied over time.

Simulation v1 is a deterministic forward progression:
- Starts from the current compiled KB.
- Applies transition rules step-by-step.
- Produces a summary of steps and optional state snapshots.

## Scope
- Transition rule representation.
- Step-by-step execution model.
- Output format for the `Simulate` pragmatic.
- Proof/trace expectations (DS18 `Simulation` mode).

## Transition Rules
Transitions are expressed as conditional sentences using the `When ... occurs, then ...` form:

```cnl
When Light_1 is red occurs, then Light_1 is green.
When Light_1 is green occurs, then Light_1 is yellow.
When Light_1 is yellow occurs, then Light_1 is red.
```

### Semantics (v1)
- The condition is evaluated in the current state.
- If the condition holds, the effect sentence is applied to the state.
- Multiple transitions may fire per step if multiple conditions hold (implementation-defined ordering must be deterministic).

## Execution Model
`Simulate N steps.`:
1. Clone the current KB state.
2. For step `1..N`:
   - Evaluate transition rules against the current state.
   - Apply the effects of the rules that fire.
3. Return a `SimulationResult`.

## Result Shape
Returns a `SimulationResult`:
- `steps`: number of simulated steps
- `states`: optional array of state summaries/snapshots
- `proof`: optional `ProofTrace` with mode `Simulation` (DS18)

## ProofTrace Requirements (Simulation)
If proof is present:
- Include, per step, which transition rules fired (when applicable).
- Summarize the final state (fact counts, key derived facts, or requested focus facts).

## References
- DS03 for transition rule syntax.
- DS10 for compilation and action/transition storage.
- DS18 for proof trace formats.

