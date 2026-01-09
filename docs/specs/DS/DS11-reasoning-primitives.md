# DS11 - Reasoning Primitives and Engines

## Summary
Defines the primitive operations on the compiled KB and how they compose into deduction, abduction, induction, and the other pragmatics (query, proof, explain, solve, plan, simulate, optimize).

## Scope
- Bitset and matrix primitives.
- Deduced fact generation (forward chaining).
- Proof, explain, and abduction flows.
- Constraint solving, planning, simulation, and optimization.

## Core Primitives
All reasoning modes depend on a small set of primitives:
- `image(pred, subjectsBitset)` -> objectsBitset
- `preimage(pred, objectsBitset)` -> subjectsBitset
- `compose(predA, predB)` -> RelationMatrix
- Bitset ops: `and`, `or`, `andNot`, `isEmpty`, `popcount`, `iterateSetBits`

`image` uses `relations[pred]`; `preimage` uses `invRelations[pred]` (DS09).

## Deduction (Forward Chaining)
- Rules compile into bitset plans (DS10).
- Use semi-naive evaluation with delta facts to avoid recomputing closure.
- For unary heads: set bits in `unaryIndex[UnaryPredID]`.
- For binary heads: set bits in `relations[pred].rows[s]` and `invRelations[pred].rows[o]`.
- Store justifications as RuleID + FactID list for each derived fact.

## Proof
Proof is a membership check in the materialized closure:
- Atomic fact: check bit presence or unary membership.
- Universal form: compute the counterexample set using set difference and test emptiness.
- Aggregations: compute numeric values from Bitset projections.

## Explain and Justifications
- Base facts are labeled `observed`.
- Derived facts store a justification DAG:
  - Node: FactID or RuleID.
  - Edge: "derived from" with premise FactIDs.
- Explanation selects a path with minimal cost (number of premises or weighted cost).

## Abduction
- Build an AND/OR proof graph for a goal.
- Missing ground premises are marked as abducible hypotheses.
- Search for minimal hypothesis sets with greedy or bounded BFS.
- Each candidate hypothesis is validated by re-running the proof plan.

## Induction (Rule Mining)
Rule candidates are generated from templates, then scored:
- Support: number of facts in both body result and head predicate.
- Confidence: support / body result size.
- Head coverage: support / head size.

Compositions such as `R(x,y) and Q(y,z) -> P(x,z)` are computed with `compose` and Bitset intersections.

## Query
Queries compile to Bitset filters:
- Unary filters: `unaryIndex[U]`.
- Binary filters: `preimage(pred, objectsSet)`.
- Relative clauses: intersect the current candidate set with filter results.

## Solve (Constraints)
Each variable has a domain Bitset. For a binary constraint `R(X,Y)`:
- `Xdom = Xdom and preimage(R, Ydom)`
- `Ydom = Ydom and image(R, Xdom)`
Use AC-3 style propagation until fixpoint.

## Plan and Simulate
State is represented as a base KB plus delta overlays:
- Preconditions are Bitset queries on the current state.
- Effects add/remove bits in the delta layers.
- Simulation iterates state transitions for N steps.

## Optimize
Optimization combines Solve with an objective:
- Objective is derived from Bitset cardinality or numeric aggregates.
- Use branch-and-bound with fast upper/lower bounds from Bitset counts.

## Propositions and Modal Constraints
Compound propositions are stored as a separate formula store:
- PropID reifies NOT/AND/OR/IMPLIES over FactIDs or other PropIDs.
- Modal or constraint statements compile to formula nodes.
Proof and explain compile formula nodes into Bitset plans or proof graphs on demand.

## References
- DS09 for KB storage layout.
- DS10 for rule compilation.
- DS12 for session-level API exposure.
- DS16 for plan IR operator definitions.
