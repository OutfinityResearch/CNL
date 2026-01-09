# src/lexer/tokenizer.mjs

## Purpose
Tokenizes UTF-8 input into a deterministic stream of tokens with spans.

## Responsibilities
- Emit IDENT, NUMBER, STRING, BOOLEAN, KEYWORD, and punctuation tokens.
- Apply longest-match rules for multi-word keywords.
- Preserve start/end spans for every token.

## Notes
- Must treat newline as whitespace, except when parsing ActionBlock lines.
