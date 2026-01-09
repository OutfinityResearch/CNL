# DS03 - Syntax (CNL-PL v1.1)

## Summary
This document defines the syntax-only contract for CNL-PL: deterministic parsing, explicit grouping rules, and a lossless AST shape. It is the authoritative reference for lexical rules, grammar, and validation requirements.

## Scope
- Syntax only (no semantic or runtime meaning).
- Deterministic parsing with explicit disambiguation rules.
- Lossless AST suitable for tooling and serialization.

## Lexical Rules
- Encoding: UTF-8.
- Whitespace separates tokens; newline is whitespace except inside ActionBlock fields.
- Comments: `//` to end of line.
- Tokens: IDENT, NUMBER, STRING, BOOLEAN, punctuation (`.`, `:`, `,`, `(`, `)`).
- Prepositions are reserved structural tokens (`of`, `to`, `at`, `in`, `on`, `with`, `for`, `from`, `into`, `between`, `among`, `over`, `under`).
- Keywords are case-insensitive and cannot be used as IDENT.
- Longest-match applies to multi-word keywords (for example, `it is not the case that`).

## Determinism Rules
- Mixed AND/OR chains at the same level are invalid without explicit grouping.
- Noun Phrase vs Name is disambiguated by the prefix:
  - Name: bare IDENT.
  - Noun Phrase: must start with determiner or quantifier.
- `has` is possessive only when followed immediately by `a|an|the|another`.

## Grammar (High-Level)
- Program is a sequence of top-level items: statements, rules, commands, action blocks.
- Statements end with `.`.
- Assertions are controlled triplets:
  - comparison, attribute, copula predicate, passive relation, active relation.
- Conditions are boolean trees with explicit grouping.
- Pragmatic commands include `return`, `verify that`, `plan to achieve`, `find`, `simulate`, `maximize`, `minimize`, `explain why`.
- ActionBlock is a multi-line structure with required `action` and `agent` fields.

## Relative Clauses
- Relative pronouns are required for each clause (`who`, `that`, `which`, `whose`, `where`).
- Chains must repeat the pronoun for each condition.

## AST Requirements
- AST nodes are normalized but preserve spans.
- Conditions keep explicit forms (BothAnd, EitherOr, NeitherNor) without semantic rewriting.
- Aggregations are explicit nodes (NumberOf, SumOf, AverageOf, TotalOf).

## Validation Errors (Must Detect)
- MixedBooleanOperatorsError
- MissingTerminatorError
- HasFormDeterminismError
- InvalidNounPhraseStartError
- RelativePronounRepetitionError
- ActionBlockMissingRequiredFieldError

## References
- See DS04 for semantics and runtime interpretation rules.
- See DS05 for testing coverage of syntax and validation.
