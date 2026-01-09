# Unit Testing Notes

## Scope
Unit tests should target a single module with minimal dependencies. They must be deterministic and suitable for automated CI.

## Targets
- Lexer tokenization and longest-match rules.
- Parser production rules and AST formation.
- Validator error reporting for each required error type.

## Conventions
- Prefer small fixtures and explicit expected AST fragments.
- Use stable ordering for serialized AST snapshots.
