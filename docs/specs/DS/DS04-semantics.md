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

## Negation (v1)
CNL-PL supports two distinct forms of negation with different semantics.

### 1) Explicit Negation (`is not` / `are not`)
Copula negation inside an assertion is treated as an **explicit negative fact** (or explicit negative rule head).

Examples:
```
Alice is not active.
Rule: Every user that is suspended is not active.
```

Semantics:
- `X is P.` asserts membership in unary predicate `P`.
- `X is not P.` asserts membership in a *separate* unary predicate `not|P`.
- `Verify that X is not P.` checks whether `X` is a member of `not|P` (not “absence of proof”).

The same encoding is used for passive relations:
- `X is signed by Y.` uses predicate key `passive:signed|by`.
- `X is not signed by Y.` uses predicate key `not|passive:signed|by`.

The same encoding is used for active relations:
- `X visits Y.` uses predicate key `<verb-group>` (internally prefixed as `P:<verb-group>`).
- `X does not visit Y.` uses predicate key `not|<verb-group>` (internally prefixed as `P:not|<verb-group>`).

This allows representing theories that use explicit negated facts/rules without collapsing them into “not provable”.

### 2) Negation-as-Failure (`it is not the case that ...`)
The scoped form:
```
it is not the case that <condition>
```
is interpreted as **negation-as-failure**:
- it evaluates to `true` exactly when `<condition>` is not derivable in the current KB state.

This form is used for control-style reasoning (planning preconditions, solve constraints, etc.) and does not require an explicit negative fact.

## Semantic Entities
- Entity: a named item or noun phrase bound to a domain object.
- Predicate: a typed verb phrase that relates subject and object.
- Unary predicate: a property or type membership.
- Attribute: a named property stored as numeric or entity-valued.
- Proposition: a compound logical structure built from atomic facts.

These entities are stabilized by ConceptualID and dense IDs (DS08).

## Identity vs Concepts (Common-Sense Model)
CNL-PL distinguishes between:
- **Things (entities):** concrete individuals with identity (a person, a specific machine, a specific package).
- **Concepts (unary predicates):** abstract categories/properties (man, mortal, server, water, hot).

### Names vs Noun Phrases
- A **Name** (bare identifier token) denotes an entity and can be interned as an `E:<name>` key (DS08).
  - Example: `Socrates`, `Server_A`, `Package_1`.
- A **Noun Phrase** (with determiner/quantifier) denotes a *set description* and compiles to a SetPlan filter (DS15/DS16).
  - Example: `a man`, `every server`, `the water`, `some packages`.

Some Names are **symbolic constants** rather than concrete individuals:
- A lowercase/hyphenated Name like `pizza` or `flat-earth` can be treated as a concept symbol (not a space/time individual).
- These symbols are still representable in the KB as nodes, but the UI should render them as concepts (DS17).

### Determiners are not identity
Articles/quantifiers (`a/an/the/every/all/no/some/...`) are *grammar markers* and must not be treated as part of an entity identifier.
The phrase `the water` does not create a new thing called `the_water`. It denotes "the set of entities that satisfy the concept `water`"
under the current KB state.

### Modeling substances and generic terms
Concept words like `water` are not entities by default. If you need a particular water sample or portion, model it as a named entity and assert
its type:
```
Water_1 is water.
Water_1 has a temperature of 0.4.
```

The same applies to generic objects when you need a specific individual:
```
Robot_1 is a robot.
Package_1 is a package.
Robot_1 carries Package_1.
```

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
- Output: justification chain (DAG) with rule and premise references, plus an optional list of base facts rendered in CNL.
- Semantics: traverse provenance created during deduction.

### Plan
- Input: goal condition and action blocks.
- Output: ordered action sequence.
- Semantics: search in the state space defined by actions; preconditions and effects use the same query primitives as Query.
  - Plan v1 uses BFS over ground actions (no variables) with a fixed depth limit of 6.
  - If the goal is already satisfied, return `satisfied` with an empty step list even when no actions exist.

### Solve
- Input: constraints and domains.
- Output: variable bindings that satisfy constraints.
- Semantics: CSP propagation over bitset domains, using KB relations as constraints.
- Command form: `Solve for <expr> [such that <condition>].`
  - Variable form: `Solve for ?X [and ?Y ...] such that <condition>.`
  - Variable constraints must be conjunctions (no OR) in v1.

### Simulate
- Input: transition rules and number of steps.
- Output: state sequence or final state.
- Semantics: apply effects deterministically to an evolving state overlay.
  - Simulate v1 applies ground transition rules in order at each step.

### Optimize
- Input: objective and constraints.
- Output: best solution according to objective.
- Semantics: Solve plus objective evaluation (cardinality or numeric aggregates).
  - If constraints include variables, v1 checks satisfiability via Solve before evaluating the objective.

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
