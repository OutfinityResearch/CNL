# src/parser/grammar/conditions.mjs

## Purpose
Parses boolean logic, assertions, and full sentences.

## Responsibilities
- Parse assertions (atomic facts): `AttributeAssertion`, `ActiveRelationAssertion`, `PassiveRelationAssertion`, `ComparisonAssertion`.
- Parse boolean conditions with explicit grouping: `AndChain`, `OrChain`, `EitherOr`, `BothAnd`.
- Parse scoping: `CaseScope` ("it is [not] the case that...").
- Parse sentences: `AssertionSentence`, `ConditionalSentence` (If/Then), `BecauseSentence`.

## Key Interfaces
- `parseConditionTokens(tokens)`: The main entry point for condition parsing.
- `parseSentenceFromTokens(tokens)`: Entry point for statement parsing.
- `parseAssertionFromTokens(tokens)`: Parses the SVO core.

## Logic Parsing
- Enforces DS03 precedence rules (must use "either/or" or "both/and" for mixed operators).
- Handles parenthesized groups.

## References
- DS03 for sentence structure and boolean grammar.
