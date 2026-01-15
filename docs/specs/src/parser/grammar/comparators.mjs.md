# src/parser/grammar/comparators.mjs

## Purpose
Parses comparison operators used in numeric and string conditions.

## Responsibilities
- Recognize multi-word comparators (e.g., "greater than or equal to", "does not contain").
- Support both copula-based forms ("is greater than") and direct forms ("greater than") depending on context.
- Return a `Comparator` AST node or `null`.

## Key Interfaces
- `isComparatorStart(token, nextToken)`: Fast check to see if a comparator begins here.
- `parseComparatorOrNull(stream, options)`: Consumes tokens if a comparator matches.
- `parseComparatorOrThrow(stream)`: Wrapper that throws `SYN005` if no comparator found.

## Supported Operators
- `EqualTo` ("equal to", "is equal to")
- `NotEqualTo` ("not equal to", "is not equal to")
- `GreaterThan`, `LessThan`
- `GreaterThanOrEqualTo`, `LessThanOrEqualTo`
- `Contains`, `NotContains` ("contains", "does not contain")

## References
- DS03 for comparator syntax.
