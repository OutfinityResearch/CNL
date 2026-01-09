# DS04 - Semantics

## Summary
This document defines how parsed AST nodes are interpreted by pragmatic engines. Syntax is fixed by DS03; DS04 describes the runtime meaning of each construct and how the pragmatic modes share a common KB and plan infrastructure.

## Scope
- Behavior of pragmatic commands (query, proof, plan, solve, simulate, optimize, explain).
- Interpretation of assertions, conditions, and aggregations.
- Runtime responsibilities for contexts, data sources, and diagnostics.

## Execution Model
The runtime follows a deterministic pipeline:
1. Parse input into AST (DS03).
2. Validate determinism and syntactic constraints (DS07).
3. Compile AST into KB updates and executable plans (DS10/DS15).
4. Execute plans using a pragmatic engine (DS11).

The semantic meaning of a program is the effect of these steps on a KB, along with any produced outputs.

## Semantic Entities
- Entity: a named item or noun phrase bound to a domain object.
- Predicate: a typed verb phrase that relates subject and object.
- Unary predicate: a property or type membership.
- Attribute: a named property stored as numeric or entity-valued.
- Proposition: a compound logical structure built from atomic facts.

These entities are stabilized by ConceptualID and dense IDs (DS08).

## Pragmatics (Behavior and Outputs)
Each pragmatic mode reuses the same KB and reasoning primitives but produces different outputs:

### Query
- Input: selection conditions and selectors.
- Output: entity sets or projected fields.
- Semantics: boolean filters over KB relations and attributes.

### Proof
- Input: proposition to verify.
- Output: boolean result and (optionally) a proof trace.
- Semantics: membership checks against the materialized closure.

### Explain
- Input: derived fact or proposition.
- Output: justification chain (DAG) with rule and premise references.
- Semantics: traverse provenance created during deduction.

### Plan
- Input: goal condition and action blocks.
- Output: ordered action sequence.
- Semantics: search in the state space defined by actions; preconditions and effects use the same query primitives as Query.

### Solve
- Input: constraints and domains.
- Output: variable bindings that satisfy constraints.
- Semantics: CSP propagation over bitset domains, using KB relations as constraints.

### Simulate
- Input: transition rules and number of steps.
- Output: state sequence or final state.
- Semantics: apply effects deterministically to an evolving state overlay.

### Optimize
- Input: objective and constraints.
- Output: best solution according to objective.
- Semantics: Solve plus objective evaluation (cardinality or numeric aggregates).

## Interaction Between Pragmatics
Pragmatics do not call each other implicitly, but they share common infrastructure:
- Query-like filters are reused in Plan preconditions and Solve constraints.
- Proof and Explain share the same justification store.
- Simulate and Plan use the same KB update semantics for effects.

If a use case requires combining modes (for example, planning with a verification step), it should be modeled explicitly as a sequence of commands.

## Aggregations
Aggregation nodes produce numeric values:
- `the number of <set>` -> cardinality
- `the sum of <selector> of <set>` -> numeric sum
- `the average of <selector> of <set>` -> numeric average

Aggregations are evaluated over the current KB state or state overlay.

## Diagnostics and Error Semantics
Runtime errors must be explicit and point back to AST spans:
- Unbound entities or attributes.
- Attribute type mismatches (numeric vs entity-valued).
- Unsupported comparator for a given attribute.
- Missing dictionary declarations when required.

Errors are not recovered or guessed; invalid programs fail deterministically.

## Example (Semantic Intuition)
```
Verify that every server that handles payments is encrypted.
```
- The condition is evaluated as a set inclusion test.
- The result is true if no counterexamples exist.
- If requested, a proof trace is generated from the justification store.

## References
- DS03 for syntax and AST.
- DS09 for KB layout.
- DS10/DS15 for compilation and plan artifacts.
- DS11 for reasoning primitives and engine behavior.
