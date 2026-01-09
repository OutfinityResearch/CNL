# DS10 - AST to KB Compilation

## Summary
Defines the deterministic compilation pipeline from AST (DS03) to the compiled KB structures (DS09). The compiler performs no heuristics: identical AST input must produce identical KB updates.

## Scope
- Compilation stages and responsibilities.
- Ground fact insertion vs rule/query construction.
- Canonical handling of predicate types and attributes.
- Error handling for non-ground or ambiguous constructs.

## Inputs and Outputs
Inputs:
- AST nodes produced by the parser.
- Optional base dictionary declarations (predicate arity, attribute types, functional constraints).

Outputs:
- KB updates (facts, unary membership, attributes).
- Rule plans (for deduction and other pragmatics).
- Compilation diagnostics.

## Compilation Stages
1. Validate AST determinism (DS03, DS07).
2. Canonicalize symbols (DS08 interner keys).
3. Split into ground facts vs non-ground constructs.
4. Emit KB updates for ground facts.
5. Emit rule/query plans for non-ground constructs.

## Grounding Rules
Ground facts are compiled only when all required terms are ground:
- Subject and object are Names or literals that map to EntityID.
- Comparators and quantifiers are fully specified.
Non-ground sentences become rule templates or query plans and are not inserted as facts.

## Predicate Type Handling
### Copula Predicate
- `X is Y` becomes:
  - Unary predicate (property/type membership).

### Active/Passive Relation
- `X overlaps with Y` -> binary relation (PredID + SubjectID + ObjectID).
- `X is assigned to Y` -> binary relation with a passive-form predicate key.

### Attribute Predicate
- `X has a capacity of 1000`:
  - Attribute `capacity` maps to AttrID.
  - Numeric value stored in `numericIndex[capacity]`.
- `X has a status of Active`:
  - Entity-valued attribute stored in `entAttrIndex[status]`.
  - Optional: project into a derived predicate `has_attr|status` for join-heavy rules.

### Comparison Predicate
Comparators (`greater than`, `less than`, `equal to`) do not become predicates.
They compile into numeric filters or rule constraints.

## Rule and Query Construction
Conditional sentences (`if ... then ...`) become rule plans:
- Body literals compile into bitset filters and joins.
- Head literals compile into unary or binary KB inserts.

Queries compile into selection plans that produce:
- A Bitset of entities (for `return` lists).
- A boolean result (for `verify that`).
- A numeric value (for aggregations).

## Determinism Requirements
- Canonical verb phrase keys are produced directly from AST fields.
- No lemmatization or synonym expansion during compilation.
- All implicit references (such as relative clause subjects) must be made explicit by AST normalization.

## Error Handling
Compilation errors must be explicit and structured:
- Non-ground fact in a fact-only context.
- Unknown attribute type (numeric vs entity-valued) when dictionary requires a choice.
- Attribute value is non-numeric and no dictionary declaration exists.
- Unsupported comparator or missing value.

## References
- DS03 for canonical AST shapes.
- DS08 for ID interning.
- DS09 for KB storage layout.
- DS11 for rule execution and reasoning.
- DS13 for dictionary declarations and validation.
- DS15 for the compiler contract and plan output.
