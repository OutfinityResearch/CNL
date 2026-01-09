# bitset.mjs

## Summary
Defines the Bitset interface and one or more concrete implementations.

## Responsibilities
- Provide `and`, `or`, `andNot`, `isEmpty`, `popcount`, `iterateSetBits`.
- Support `setBit` and `clearBit` mutations.
- Avoid implementation-specific logic in reasoning algorithms.

## Key Interfaces
- `createBitset(size)`
- `clone()`
- `and(other)`
- `or(other)`
- `andNot(other)`
- `setBit(index)`
- `clearBit(index)`

## References
- DS09 for KB layout.
- DS11 for reasoning primitives.
