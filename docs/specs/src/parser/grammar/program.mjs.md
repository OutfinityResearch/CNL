# src/parser/grammar/program.mjs

## Purpose
The high-level parser that processes a full source text into a `Program` AST.

## Responsibilities
- Split source into lines/statements.
- Handle `ActionBlock` parsing (multi-line blocks starting with `Action:`).
- Detect and parse `ContextDirective` (`--- context: Name ---`).
- Dispatch single lines to `parseLineStatement`.
- Support incremental parsing (`parseProgramIncremental`).

## Key Interfaces
- `parseProgram(source)`: Returns the full AST or throws on first error.
- `parseProgramIncremental(source)`: Returns `{ program, errors }`, attempting to recover from line-level errors.

## Statement Types
- `Statement` (Declarative sentence)
- `RuleStatement` (`Rule: ...`)
- `CommandStatement` (`Command: ...` or implicit imperative verb)
- `TransitionRuleStatement` (`When ... occurs ...`)
- `ActionBlock`

## References
- DS03 for program structure.
