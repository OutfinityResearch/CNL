# DS09 - Compiled Knowledge Base (KB) Representation

## Summary
Defines the compiled KB storage model optimized for fast reasoning: subject-centric relations, inverse indices, unary predicates, and numeric attributes. This is the canonical runtime layout consumed by all pragmatics.

## Scope
- KB core structures and indices.
- Bitset interface requirements.
- Storage for unary predicates, binary relations, and attributes.
- FactID strategy for provenance without per-fact storage.

## Bitset Interface
Bitset is an implementation detail behind a stable interface:
- `and(other)`
- `or(other)`
- `andNot(other)`
- `isEmpty()`
- `popcount()`
- `iterateSetBits(fn)`
- `setBit(index)`
- `clearBit(index)`

Implementations can be BigInt, Uint64Array chunks, or compressed bitmaps. Algorithms must depend only on the interface.

## Core KB Layout
The KB is defined around dense IDs (DS08) and row-wise relation access.

```
KB {
  entitiesCount: number
  predicatesCount: number
  unaryCount: number
  attributesCount: number

  relations: RelationMatrix[]       // size: predicatesCount
  invRelations: RelationMatrix[]    // size: predicatesCount
  unaryIndex: Bitset[]              // size: unaryCount
  numericIndex: NumericIndex[]      // size: attributesCount
  entAttrIndex: EntityAttrIndex[]   // size: attributesCount
}

RelationMatrix {
  rows: Bitset[]                    // rows[subjectId] => Bitset(objects)
}
```

### Subject-Centric View (SRep)
A subject-local view can be cached for convenience:
```
SRep {
  relations: Map<PredID, Bitset>
  unary: Bitset
  types: Bitset
  numAttrs: Map<AttrID, number>
  entAttrs: Map<AttrID, Bitset>
}
```
SRep is optional; the authoritative data is in the RelationMatrix and unaryIndex arrays.

## Binary Relations
For each PredID:
- `relations[pred].rows[s]` stores the Bitset of objects reachable from subject `s`.
- `invRelations[pred].rows[o]` stores the Bitset of subjects that reach object `o`.

Both matrices must be updated together to keep image/preimage operations fast.

## Unary Predicates and Types
Unary predicates are stored as global bitsets:
- `unaryIndex[UnaryPredID]` is a Bitset of entities that satisfy the predicate.

Types are not special at the storage level; they are unary predicates with reserved meaning.

## Attributes
Attributes can be numeric or entity-valued:

### NumericIndex
```
NumericIndex {
  values: Float64Array        // or Int64Array
  hasValue: Bitset
  sortedSubjects: Int32Array? // optional, for fast range queries
}
```

### EntityValued Attributes
```
EntityAttrIndex {
  values: Bitset[]            // values[subjectId] => Bitset(entityIds)
}
```

Attributes must be declared functional or multi-valued in the dictionary; the storage shape should reflect that choice.

## FactID Strategy
FactID is derived from the tuple (PredID, SubjectID, ObjectID) to avoid storing a FactID per bit:
- If ranges allow, pack into 64-bit: `(PredID << a) | (SubjectID << b) | ObjectID`.
- Otherwise use a stable 128-bit hash and store collision maps only when needed.

FactID is required for justification and explain traces, not for membership checks.

## References
- DS08 for ConceptualID and dense ID mappings.
- DS10 for deterministic compilation into this layout.
- DS11 for reasoning operations on these structures.
