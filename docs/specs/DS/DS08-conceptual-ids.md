# DS08 - Conceptual IDs and Dense Universes

## Summary
Defines stable, typed ConceptualID values and the dense runtime universes required by bitset-based reasoning. This spec is the identity layer for all KB storage and reasoning primitives.

## Scope
- ConceptualID format and concept kinds.
- Canonical keys for interning.
- Dense runtime IDs (EntityID, PredID, UnaryPredID, AttrID).
- Mapping rules between ConceptualID and dense IDs.

## ConceptualID
ConceptualID is a stable, typed identifier for all symbolic concepts that appear in the KB, rules, and explanations.

### Format
- ConceptualID is an unsigned 64-bit integer.
- High 8 bits are the kind tag.
- Low 56 bits are the per-kind index.

```
ConceptualID = (kind << 56) | index
```

### Concept Kinds
The following kinds are reserved and can be extended in the future:
- Entity
- Predicate
- UnaryPredicate
- Attribute
- Literal
- Rule
- Action
- Fact
- Proposition

The kind tag must be explicit so that a ConceptualID never needs external context to be interpreted.

## Canonical Keys and Interning
ConceptualIDs are created by interning canonical keys:
- Entity: canonical form of Name or entity-like Literal.
- Predicate: canonical VerbPhrase structure (type + lemma + particles + comparator).
- UnaryPredicate: canonical property name or type name.
- Attribute: canonical AttributeRef (core + PP).
- Literal: normalized literal value (number/string/boolean) with type tag.

Interning is deterministic and uses the lossless AST fields from DS03. No heuristics are allowed in canonicalization. If a key cannot be produced deterministically, compilation must fail with an explicit error.

## Dense Runtime Universes
Bitsets require dense indices. Each ConceptualID of a supported kind is mapped to a dense integer in [0..N):
- EntityID: dense index for entities and entity-like literals.
- PredID: dense index for binary relations.
- UnaryPredID: dense index for unary predicates.
- AttrID: dense index for attributes used in numeric or entity-valued slots.

Dense IDs are session-scoped. The ConceptualID remains the stable identifier across sessions, while dense IDs are optimized for runtime.

## Mapping Rules
- Each ConceptualID kind has its own interner and dense mapping table.
- The mapping must be bijective within a session.
- Reverse mapping (dense ID -> ConceptualID -> text) must be kept for explain/debug output.

## Stability and Persistence
- ConceptualIDs are stable within a session.
- If persistence across sessions is required, serialize the interner tables and reuse them at load time.

## References
- DS09 for KB layout that uses EntityID and PredID.
- DS10 for compilation rules that produce ConceptualIDs.
