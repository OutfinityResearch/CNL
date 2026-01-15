# DS09 - Compiled Knowledge Base (KB) Representation

## Summary
Defines the compiled KB storage model optimized for fast reasoning: subject-centric relation matrices, inverse indices, unary predicate sets, and attribute indexes. This is the canonical runtime layout consumed by all pragmatics.

## Scope
- KB core structures and indices.
- Bitset interface requirements.
- Storage for unary predicates, binary relations, and attributes.
- FactID strategy for provenance without per-fact storage.

## Design Goals
- Compact storage that scales to large entity sets.
- Fast `image` and `preimage` operations for reasoning.
- Deterministic updates (no heuristics or background reindexing).

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

Implementations can be BigInt, Uint64Array chunks, or compressed bitmaps. Algorithms must depend only on this interface.

## Core KB Layout
The KB is defined around dense IDs (DS08) and row-wise relation access:

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
SRep is optional; the authoritative data is in the global matrices and indexes.

## Binary Relations
For each PredID:
- `relations[pred].rows[s]` stores the Bitset of objects reachable from subject `s`.
- `invRelations[pred].rows[o]` stores the Bitset of subjects that reach object `o`.

Both matrices must be updated together. At the API boundary, a fact insert is atomic: the forward and inverse indices are modified as one logical operation.

## Unary Predicates and Types
Unary predicates are stored as global bitsets:
- `unaryIndex[UnaryPredID]` is a Bitset of entities that satisfy the predicate.

Types are represented as unary predicates; there is no special storage class for types.

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

### Entity-Valued Attributes
```
EntityAttrIndex {
  values: Bitset[]            // values[subjectId] => Bitset(entityIds)
}
```

Attributes must be declared functional or multi-valued in the dictionary. The storage shape follows that choice.

Entity-valued attributes may optionally be projected into a derived binary predicate
`has_attr|<AttrKey>` for join-heavy reasoning. This is a compiler option, not a KB requirement.

## FactID Strategy
FactID is derived from the tuple (PredID, SubjectID, ObjectID) to avoid storing a FactID per bit:
- We use stable **128-bit BigInt packing** (not hashing) with u32 fields.
  - Binary fact: `(PredID << 64) | (SubjectID << 32) | ObjectID` (all u32).
  - Unary fact: `(1 << 127) | (UnaryID << 32) | SubjectID` (all u32, with a kind bit).

Collision handling is explicit:
- There are no hash collisions in the packed form (range checks are enforced at construction).

FactID is required for provenance and explain traces, not for membership checks.

## Example (Intuition)
If `likes` is PredID 3 and `Alice` is EntityID 10, then the fact:
```
Alice likes Pizza.
```
sets bit `Pizza` in `relations[3].rows[10]` and sets bit `Alice` in `invRelations[3].rows[Pizza]`.

## References
- DS08 for ConceptualID and dense ID mappings.
- DS10 for deterministic compilation into this layout.
- DS11 for reasoning operations on these structures.
