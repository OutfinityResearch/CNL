# DS05 - Testing Plan

## Summary
Defines the automated testing strategy for CNL-PL, including unit tests, parser fixtures, validator error cases, and pragmatic command coverage.

## Objectives
- Ensure deterministic parsing and stable AST shapes.
- Detect all validation errors defined in DS03.
- Verify pragmatic command parsing and execution outputs.

## Test Types
- Unit tests: lexer, parser, AST construction, validator rules.
- Golden tests: input text to expected AST JSON snapshots.
- Error tests: invalid inputs for each required validation error.
- Developer tests: ad-hoc or exploratory cases, kept in a separate folder.

## Coverage Matrix
- Lexical tokens and multi-word keywords.
- Noun phrase vs name disambiguation.
- AND/OR grouping rules and error detection.
- Action block required fields and parsing.
- Command parsing for all pragmatics.

## Test Organization
- `tests/lexer/` - tokenization and longest-match behavior.
- `tests/parser/` - grammar and AST shapes.
- `tests/validator/` - deterministic error conditions.
- `tests/pragmatics/` - command parsing and runtime bindings.
- `tests/developer/` - exploratory cases, clearly labeled.

## Tooling
- Snapshot format: JSON or canonicalized CNL AST.
- Deterministic ordering for AST serialization.
- Optional fuzzing for mixed operator detection.

## Related Specs
- DS03 for syntax and validation errors.
- DS06 for evaluation suites that go beyond unit tests.
