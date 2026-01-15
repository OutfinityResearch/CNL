# src/parser/grammar/token-stream.mjs

## Purpose
Provides a stateful cursor over the token array, enabling lookahead and consumption.

## Responsibilities
- `TokenStream` class: `peek()`, `consume()`, `matchWord()`, `matchPunct()`.
- Helper functions for token classification (`isDeterminerToken`, `isStartOfNounPhrase`).
- Inline comment stripping (`stripInlineComment`).
- Balanced parentheses validation (`ensureBalancedParentheses`).

## Key Interfaces
- `TokenStream`
- `isStartOfNounPhrase(token, nextToken)`: Critical for distinguishing noun phrases from other constructs.
- `stripInlineComment(line)`: Handles `//` comments.

## References
- DS03 for syntax rules.
