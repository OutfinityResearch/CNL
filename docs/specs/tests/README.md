# Tests Mirror

## Purpose
This folder describes test files and their intent. Each test file has a matching markdown description with the same relative path plus `.md`.

## Planned Structure
- `tests/lexer/` - lexical and tokenization cases.
- `tests/parser/` - grammar and AST shape tests.
- `tests/validator/` - determinism errors.
- `tests/pragmatics/` - command parsing and runtime bindings.
- `tests/developer/` - exploratory and developer tests.

## Example Mapping
- Runtime test: `tests/parser/mixed-operators.test.mjs`
- Spec mirror: `docs/specs/tests/parser/mixed-operators.test.mjs.md`
