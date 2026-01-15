# src/runtime/engine/helpers.mjs

## Purpose
Provides low-level utilities for runtime execution, ID resolution, and set manipulation.

## Responsibilities
- Resolve AST nodes (Names, VerbGroups, Literals) to Dense IDs using the `state` context.
- Provide canonical key generation for runtime predicates (e.g., `P:verb|prep`).
- Manipulate bitsets (`emptySet`, `fullSet`, `entitySet`).
- Collect variables (`?X`) from AST nodes.
- Standardize runtime error objects.

## Key Interfaces
- `resolveEntityId(node, state)`: Maps NounPhrase/Name/Literal to EntityID.
- `resolvePredId(assertion, state)`: Maps assertion verb phrases to PredicateID.
- `collectEntities(set, state)`: Converts a bitset to an array of `{ id, key }`.
- `collectVariables(node, set)`: Recursively finds `Variable` nodes.
- `runtimeError(code, message)`: Creates a standardized error object.

## References
- DS08 for ID strategy.
- DS16 for runtime structures.
