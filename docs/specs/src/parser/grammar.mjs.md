# src/parser/grammar.mjs

## Purpose
Builds the AST defined in DS03 from the token stream.

## Responsibilities
- Parse top-level items: statements, rules, commands, action blocks.
- Enforce explicit grouping for boolean conditions.
- Attach relative clauses to noun phrases deterministically.

## Notes
- Must emit validation errors for missing terminators and invalid NP starts.
