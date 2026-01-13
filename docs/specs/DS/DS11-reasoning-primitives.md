# DS11 - Reasoning Primitives and Engines

## Summary
Defines the primitive operations on the compiled KB and how they compose into deduction, abduction, induction, and the pragmatics (query, proof, explain, solve, plan, simulate, optimize).

## Scope
- Bitset and matrix primitives.
- Deduction and proof.
- Explain and abduction flows.
- Induction (rule mining) templates.
- Constraint solving, planning, simulation, and optimization.

## Core Primitives
All reasoning modes depend on a small set of primitives:
- `image(pred, subjectsBitset)` -> objectsBitset
- `preimage(pred, objectsBitset)` -> subjectsBitset
- `compose(predA, predB)` -> RelationMatrix
- Bitset ops: `and`, `or`, `andNot`, `isEmpty`, `popcount`, `iterateSetBits`

`image` uses `relations[pred]`; `preimage` uses `invRelations[pred]` (DS09).

Example:
- `image(likes, {Alice, Bob})` returns all objects liked by Alice or Bob.
- `preimage(likes, {Pizza_1})` returns all subjects who like Pizza_1.

## Deduction (Forward Chaining)
Rules compile into bitset plans (DS10). Deduction is performed by forward chaining:
- Use semi-naive evaluation with delta facts to avoid recomputation.
- Unary heads set bits in `unaryIndex[UnaryPredID]`.
- Binary heads set bits in `relations[pred].rows[s]` and `invRelations[pred].rows[o]`.
- Attribute heads update `numericIndex[attr]` and `entAttrIndex[attr]` and must participate in delta
  tracking so that rules depending on attributes are re-evaluated when attribute values change.

Derived facts carry justifications as `RuleID + premise FactIDs` (DS09/DS15). FactIDs cover unary, binary,
numeric attributes, and entity-valued attributes (DS18).

## Proof
Proof reduces to membership checks in the materialized closure:
- Atomic fact: check bit presence or unary membership.
- Universal form: compute counterexamples via set difference and test emptiness.
- Aggregations: compute numeric values from Bitset projections.

Example:
```
Verify that every server that handles payments is encrypted.
```
This is evaluated as:
`Servers ∩ preimage(handles, {payments}) ⊆ Encrypted`.

## Explain
Explain traverses the justification DAG:
- Base facts are labeled `Base`.
- Derived facts link to a `RuleID` and its premises.
- The engine may also surface a flattened list of base facts that support the result.

Explain and proof traces should be able to reference attribute facts as premises:
- Numeric attributes: `X has a capacity of 1000.`
- Entity-valued attributes: `User1 has a role of admin.`

## Abduction
Abduction constructs an AND/OR proof graph for a goal:
- OR nodes: alternative rules that could derive the goal.
- AND nodes: all premises required by a rule.
- Missing ground premises are abducible hypotheses.

Minimal hypothesis sets can be found with greedy search or bounded BFS.

## Induction (Rule Mining)
Rule induction uses templates and bitset scoring:
- Template: `R(x,y) and Q(y,z) -> P(x,z)`
- Compute `C = compose(R, Q)`.
- Support = pairs in `C` that are also in `P`.
- Confidence = support / size(C).
- Head coverage = support / size(P).

Candidate generation is constrained by thresholds to keep search tractable.

## Query
Queries compile to set plans:
- Unary filters: `unaryIndex[U]`.
- Binary filters: `preimage(pred, objectsSet)`.
- Relative clauses: intersect with additional filters.

Example:
```
Return the name of every user who is active and who knows python.
```
This becomes: `Users ∩ Active ∩ preimage(knows, {python})`.

## Solve (Constraints)
Each variable has a domain Bitset. For a binary constraint `R(X,Y)`:
- `Xdom = Xdom and preimage(R, Ydom)`
- `Ydom = Ydom and image(R, Xdom)`

Use AC-3 style propagation until fixpoint or failure.

Variables use the `?X` syntax and denote entity domains. Solve v1 supports conjunctive
constraints only (no OR branches); each atomic constraint must be grounded except
for variable subject/object positions.

## Plan and Simulate
State is represented as a base KB plus delta overlays:
- Preconditions are Bitset queries on the current state.
- Effects add/remove bits or update attributes in the delta layer.
- Simulation iterates transition rules for N steps.

Plan v1 is restricted to ground actions (no variables) and uses BFS with a fixed depth limit of 6.
Simulate v1 applies ground transition rules in sequence per step.

## Optimize
Optimization combines Solve with an objective:
- Objective is derived from Bitset cardinality or numeric aggregates.
- Use branch-and-bound with fast bounds from Bitset counts.

## Propositions and Modal Constraints
Compound propositions are stored in a separate formula store:
- PropID reifies NOT/AND/OR/IMPLIES over FactIDs or other PropIDs.
- Modal or constraint statements compile to formula nodes.

Proof and explain compile formula nodes into bitset plans or proof graphs on demand.

## References
- DS09 for KB storage layout.
- DS10 for rule compilation.
- DS12 for session-level API exposure.
- DS16 for plan IR operator definitions.
