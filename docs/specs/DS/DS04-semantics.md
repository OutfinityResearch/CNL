# DS04 - Semantics

## Summary
This document defines how parsed AST nodes are interpreted by pragmatic engines. Syntax is fixed by DS03; DS04 describes the runtime meaning of each construct.

## Scope
- Pragmatic command behavior (query, proof, plan, solve, simulate, optimize, explain).
- Interpretation of assertions, conditions, and aggregations.
- Runtime responsibilities for contexts and data sources.

## Execution Model
- Parse input into AST.
- Validate AST for determinism errors.
- Select a pragmatic engine based on the command or caller context.
- Execute the AST against a knowledge base or runtime adapter.

## Semantic Entities
- Entity: named item or noun-phrase bound to a domain object.
- Attribute: property of an entity resolved through schema or context.
- Relation: verb group linking subject and object in a defined model.

## Pragmatics
- Query: evaluate conditions, return selectors or lists.
- Proof: attempt to derive propositions from rules and facts.
- Plan: use action blocks to produce an ordered plan toward a goal condition.
- Solve: treat constraints as a CSP, bind variables to satisfy conditions.
- Simulate: apply transition rules for N steps to update state.
- Optimize: compute argmax/argmin under constraints.
- Explain: return a causal trace or justification chain.

## Aggregations
- NumberOf, SumOf, AverageOf, TotalOf operate on sets defined by noun phrases.
- Aggregation results are numeric literals in the AST evaluation context.

## Error Handling
- Invalid or unbound references must produce explicit runtime errors.
- Ambiguous references are rejected, not guessed.

## Examples (Semantic)
- Query: "Return the name of every user whose role is Admin." returns a list of names.
- Proof: "Verify that every server that handles payments is encrypted." returns true/false with a proof trace.
- Plan: "Plan to achieve all packages delivered." returns a sequence of action signatures.

## Open Questions
- Target proof system interface (Datalog, SMT, custom inference).
- Canonical representation of proof traces in CNL vs JSON.
