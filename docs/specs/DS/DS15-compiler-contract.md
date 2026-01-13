# DS15 - Compiler Contract (AST to KB + Plans)

## Summary
Defines the normative compiler contract that transforms a deterministic AST into a compact KB and executable plan artifacts. The compiler is deterministic, produces no heuristics, and is independent of any execution engine.

## Scope
- Inputs and outputs of the compiler.
- Concept and ID allocation rules used by compilation.
- Ground fact eligibility.
- Deterministic mapping for atomic sentences, conditions, and rules.
- Plan emission for rules, commands, and action blocks.
- Provenance and justification metadata.

## Inputs and Outputs
Inputs:
- Deterministic AST (DS03).
- Optional BaseDictionary declarations (DS13).

Outputs:
- `SymbolTable`: ConceptualID interning with reverse lookup.
- `DenseMaps`: ConceptualID to EntityID/PredID/UnaryID/AttrID.
- `KB`: compiled facts and indices (DS09).
- `FormulaStore`: proposition nodes for non-atomic constraints.
- `RuleStore`: rule plans for deduction.
- `ActionStore`: action plans (preconditions/effects).
- `CommandStore`: query/proof/solve/plan/optimize plans.

## Determinism Rules
- All canonical keys must be derived from AST fields only.
- No lemmatization, synonym expansion, or heuristic rewrites.
- Re-compiling the same AST in the same session yields identical IDs and plans.

## ConceptualID Canonical Keys
Compiler uses the DS08 interner with strict keys:
- Entity: `E:<Name or Literal>`
- Predicate: `P:<VerbPhraseKey>`
- Unary predicate: `U:<PropertyOrType>`
- Attribute: `A:<AttributeKey>`
- Literal: `L:<normalized literal>`
- Comparator (optional): `C:<op>`

VerbPhraseKey is the canonical structure from DS03 (verb + particles + comparator).

## Dense IDs
- EntityID for names and entity-like literals used in relations.
- PredID for binary relations only.
- UnaryID for copular properties and types.
- AttrID for attributes.

Dense IDs are allocated deterministically by first-seen order in the compilation stream.

## Ground Fact Eligibility
An atomic sentence becomes a ground fact only if:
- Subject is a Name or literal that maps to EntityID.
- Object/value is ground for the predicate type.

Atomic sentences with quantified noun phrases or relative clauses do not produce facts; they produce plans.

## Atomic Sentence Compilation
Each atomic sentence maps to one of:
- `InsertBinaryFact`
- `InsertUnaryFact`
- `InsertNumericAttr`
- `InsertEntityAttr`
- `EmitConstraint`

### Active/Passive Relations
If predicate is a verb phrase relation:
- Compile to `InsertBinaryFact(S, PredID, O)` when S and O are ground.
- Insert is idempotent and updates forward and inverse indices.

### Copula Predicate
Simple copula (`X is Y`) compiles as unary membership:
- `InsertUnaryFact(UnaryID(Y), S)`
Copula does not compile as a binary relation by default.

### Attribute Predicate
If AST is an AttributeAssertion:
- Attribute name -> AttrID.
- Numeric value -> `InsertNumericAttr(AttrID, S, value)`.
- Entity value -> `InsertEntityAttr(AttrID, S, EntityID)`.

Entity-valued attributes may optionally be projected into a derived binary predicate `P:has_attr|<AttrKey>` for join compatibility, but the primary storage is `entAttrIndex`.

### Comparison Predicate
Comparisons are constraints, not facts:
- `EmitConstraint(Compare(leftExpr, op, rightExpr))`.
- Constraints are stored in FormulaStore or in RulePlan bodies.

## Noun Phrases and Relative Clauses
Noun phrases with relative clauses compile into SetPlans:
- Base set from unary type (if present).
- Each relative clause adds a filter:
  - `preimage(pred, objectSet)` for relation clauses.
  - `NumFilter(attr, comparator, value)` for numeric clauses.
  - `AttrEntityFilter(attr, valueSet)` for entity-valued attributes.

No new entity IDs are created for noun phrases.

## Condition Compilation
Boolean conditions preserve AST structure:
- AND -> set intersection.
- OR -> set union.
- NOT -> set complement relative to an explicit universe.

The compiler must not rewrite boolean structures beyond AST normalization.

## Rule Compilation
Rule statements compile into RulePlans:
- Body produces bindings via SetPlans and relation joins.
- Head emits unary/binary facts or attribute assignments.

Restrictions:
- Every head variable must appear in the body.
- OR in body is split into multiple RulePlans.

Rule labels are syntactic: `Rule:` statements follow the same compilation rules as unlabeled statements.
If the sentence is conditional or universally quantified, it yields a `RulePlan`; otherwise it compiles as a
ground assertion (or a compilation error if non-ground without a universal quantifier).

## Action Blocks
Action blocks compile into:
- `PreconditionPlan` using the same SetPlan/BoolPlan operators.
- `EffectDelta` as KB mutations (set/clear bits and numeric updates).

## Provenance and Justifications
Each inserted fact can carry provenance:
- Base fact: source metadata (span and statement index if available).
- Derived fact: `DerivedFact(ruleID, premiseFactIDs[])`.

Justification storage may be lazy, but must be sufficient to support EXPLAIN.

FactIDs used for provenance include:
- Unary facts: `U(subjectId, unaryId)`
- Binary facts: `B(subjectId, predId, objectId)`
- Numeric attributes: `N(subjectId, attrId, value)`
- Entity-valued attributes: `EA(subjectId, attrId, entityId)`

When a rule body includes attribute filters (`NumFilter`, `AttrEntityFilter`), premiseFactIDs should include
the corresponding attribute facts for the chosen witness value(s) so that DS18 proof traces can expand
rule chains across attribute-based reasoning.

## Compiler API (Minimum)
```
compileProgram(ast) -> CompiledArtifacts
internConcept(kind, key) -> ConceptualID
getOrCreateEntityID(conceptId) -> EntityID
insertBinary(subjectId, predId, objectId, provenance?)
insertUnary(unaryId, subjectId, provenance?)
setNumeric(attrId, subjectId, value, provenance?)
insertEntityAttr(attrId, subjectId, entityId, provenance?)
compileNPPlan(npNode) -> SetPlan
compileConditionPlan(condNode, universe) -> SetPlan | BoolPlan
compileRule(ruleNode) -> RulePlan
compileAction(actionNode) -> ActionPlan
```

## Errors
Compiler must emit structured errors for:
- Non-ground facts in fact-only contexts.
- Attribute value type mismatch against BaseDictionary.
- Unsupported comparator for an attribute.
- Dictionary declaration used outside BaseDictionary context.
- Variables used in learned statements or rules.

## References
- DS03 for AST shapes.
- DS08 for ConceptualID.
- DS09 for KB layout.
- DS10 for high-level compilation overview.
- DS13 for BaseDictionary declarations.
- DS16 for Plan IR.
