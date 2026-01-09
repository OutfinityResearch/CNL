# DS10 - AST to KB Compilation

## Summary
Defines the deterministic compilation pipeline from AST (DS03) to the compiled KB structures (DS09). The compiler performs no heuristics: identical AST input must produce identical KB updates and plans.

## Scope
- Compilation stages and responsibilities.
- Ground fact insertion vs rule/query construction.
- Canonical handling of predicate types and attributes.
- Error handling for non-ground or ambiguous constructs.

## Inputs and Outputs
Inputs:
- AST nodes produced by the parser.
- Optional BaseDictionary declarations (predicate arity, attribute types, functional constraints).

Outputs:
- KB updates (facts, unary membership, attributes).
- Rule plans (for deduction and other pragmatics).
- Query/command plans.
- Compilation diagnostics tied to source spans.

## Compilation Stages
1. Validate AST determinism (DS03, DS07).
2. Canonicalize symbols into ConceptualIDs (DS08).
3. Split into ground facts vs non-ground constructs.
4. Emit KB updates for ground facts.
5. Emit rule/command plans for non-ground constructs.

## Grounding Rules
Ground facts are compiled only when all required terms are ground:
- Subject and object are Names or literals that map to EntityID.
- Comparators and values are fully specified literals.

Non-ground sentences (quantified NPs, relative clauses, variables) become rule or query plans and are not inserted as facts.

## Predicate Type Handling
### Copula Predicate
```
X is Y.
```
Compiles as unary membership:
- `UnaryPredID(Y)` contains `X`.

### Active/Passive Relation
```
X overlaps with Y.
X is assigned to Y.
```
Compiles as binary facts:
- `PredID` is derived from the typed verb phrase (including preposition).
- Insert into `relations` and `invRelations`.

### Attribute Predicate
```
X has a capacity of 1000.
X has a status of Active.
```
- Attribute name -> AttrID.
- Numeric value -> `numericIndex[AttrID]`.
- Entity-valued value -> `entAttrIndex[AttrID]`.
- Optional: project into derived predicate `has_attr|<AttrKey>` for join-heavy reasoning.

### Comparison Predicate
Comparators do not become predicates. They compile into numeric filters or rule constraints.

## Canonical Verb Phrase Keys
Predicate IDs are derived from structured verb phrase keys, not raw strings:
- Copula + comparator
- Verb + particles
- Passive copula + verb + preposition

This ensures two implementations produce the same predicate IDs.

## Rule and Query Construction
Conditional sentences compile into rule plans:
- Body literals become bitset filters and joins.
- Head literals become unary or binary KB inserts.

Queries compile into selection plans that produce:
- A Bitset of entities (for `return` lists).
- A boolean result (for `verify that`).
- A numeric value (for aggregations).

Example:
```
Rule: Every user who knows Python is an engineer.
```
Becomes a plan that intersects `Users` with `preimage(knows, {Python})` and inserts the result into `engineer`.

## Determinism Requirements
- Canonical keys are derived directly from AST fields.
- No lemmatization, synonym expansion, or heuristic rewrites.
- Implicit references (relative clause subjects) are made explicit by AST normalization before compilation.

## Error Handling
Compilation errors must be explicit and structured:
- Non-ground fact in a fact-only context.
- Unknown attribute type (numeric vs entity-valued) when a dictionary requires a choice.
- Attribute value is non-numeric and no dictionary declaration exists.
- Unsupported comparator or missing value.

## References
- DS03 for canonical AST shapes.
- DS08 for ID interning.
- DS09 for KB storage layout.
- DS11 for rule execution and reasoning.
- DS13 for dictionary declarations and validation.
- DS15 for the compiler contract and plan output.
