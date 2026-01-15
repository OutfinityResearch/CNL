# src/runtime/engine/effects.mjs

## Purpose
Applies side-effects (KB mutations) derived from Action effects or Transition rules.

## Responsibilities
- Interpret `AssertionSentence` nodes as mutations.
- Insert facts into the KB (unary, binary, attribute).
- Validate that effects are ground (no variables allowed in V1).

## Key Interfaces
- `applySentenceEffect(sentence, kbApi, state)`: Main entry point.
- `applyAssertion(assertion, kbApi, state)`: Dispatches based on assertion kind.

## Supported Effects
- `CopulaPredicateAssertion` (insert unary)
- `Active/PassiveRelationAssertion` (insert binary)
- `AttributeAssertion` (set numeric or entity attribute)

## References
- DS19 for Planning effects.
- DS20 for Simulation effects.
