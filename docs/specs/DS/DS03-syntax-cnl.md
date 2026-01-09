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
- Single-letter uppercase identifiers (A..Z) are allowed as Name tokens in contexts where a Name is expected, even if they collide with determiners in lowercase.
- Aggregation set references accept a bare head noun (for example `the number of packages`); the parser canonicalizes it to a NounPhrase with an implicit `the`.

## Atomic Sentence and Typed Predicates
The atomic sentence is the unit of determinism. A predicate is not free text; it is one of a fixed set of typed templates:
- Copula predicate: `X is Y`.
- Comparison predicate: `X is greater than Y` (copula + comparator).
- Attribute predicate: `X has a capacity of 1000` (has + determiner + attribute + optional value).
- Passive relation: `X is assigned to Y` (copula + verb + preposition).
- Active relation: `X overlaps with Y`, optionally with auxiliary (`has logged in`).

This typing prevents ambiguity about where the verb ends and the object begins.

## Canonical Triplet Mapping
Every atomic sentence deterministically maps to a structured SVO triplet:
- Subject: the atomic subject term (Name, NounPhrase, Literal, Aggregation).
- VerbPhrase: a structured object that preserves predicate type and parts.
- Object: the complement or object term.

The verb phrase is not a string. It is a structured record that captures copula/comparator, verb/particles, or attribute form, so two implementations always produce the same triplet.

### Examples
- `temperature is greater than 20` -> subject: `temperature`, verbPhrase: `is + GreaterThan`, object: `20`.
- `route is valid` -> subject: `route`, verbPhrase: `is`, object: `valid`.
- `meeting overlaps with another meeting` -> subject: `meeting`, verbPhrase: `overlaps + with`, object: `another meeting`.
- `user has logged in today` -> subject: `user`, verbPhrase: `has + logged + in`, object: `today`.

## Attribute Assertion Representation
For attribute assertions, the canonical form preserves the attribute and value separately:
- Subject: the owner entity.
- VerbPhrase: a typed `HAS_ATTR` (or `has` with attribute type).
- Object: the attribute term (for example `capacity`).
- Value: stored in a dedicated `value` field when present.

This avoids collapsing the attribute into the verb and keeps the structure lossless.

## Relative Clauses and Implicit Subjects
Relative clauses introduce atomic sentences with an implicit subject that is the head of the noun phrase.
- `a user who knows Python` is canonicalized to `(user, knows, Python)`.
- `whose score is greater than 10` is represented as a `RelAttributeLike` predicate anchored to the head, with a comparator predicate on the attribute.

Relative chains must repeat the pronoun for each condition.

## Structural Nodes vs Triples
`Rule:`, `Command:`, `If ... then ...`, `Either ... or ...`, and block labels are structural nodes. They are not triplets. Only atomic assertions map to SVO triplets; structural nodes merely organize them.

## Grammar (High-Level)
- Program is a sequence of top-level items: statements, rules, commands, action blocks.
- Statements end with `.`.
- Assertions are controlled triplets:
  - comparison, attribute, copula predicate, passive relation, active relation.
- Conditions are boolean trees with explicit grouping.
- Pragmatic commands include `return`, `verify that`, `plan to achieve`, `find`, `simulate`, `maximize`, `minimize`, `explain why`.
- ActionBlock is a multi-line structure with required `action` and `agent` fields.
- Conditional sentences allow both:
  - Prefix: `if <condition>, then <sentence>`.
  - Postfix: `<sentence> if <condition>` (desugared to the prefix form).

## Relative Clauses
- Relative pronouns are required for each clause (`who`, `that`, `which`, `whose`, `where`).
- Chains must repeat the pronoun for each condition.

## AST Requirements
- AST nodes are normalized but preserve spans.
- Conditions keep explicit forms (BothAnd, EitherOr, NeitherNor) without semantic rewriting.
- Aggregations are explicit nodes (NumberOf, SumOf, AverageOf, TotalOf).
- Statement wraps a Sentence node.
- AssertionSentence is a wrapper node with a single `assertion` field.
- ConditionalSentence uses `condition` and `then` fields.
- Name nodes use a `value` field for the identifier.
- Case scopes for `it is the case that` and `it is not the case that` use a `CaseScope` node with `mode` and `operand`.
- AttributeAssertion uses an `AttributeRef` with `core` and `pp` fields, plus an optional `value` term.
- RelativeClause bodies use typed nodes such as `RelCopulaPredicate`, `RelActiveRelation`, `RelPassiveRelation`, `RelComparison`, and `RelAttributeLike`.

## Validation Errors (Must Detect)
- MixedBooleanOperatorsError
- MissingTerminatorError
- HasFormDeterminismError
- InvalidNounPhraseStartError
- RelativePronounRepetitionError
- ActionBlockMissingRequiredFieldError

See DS07 for the canonical error codes and standard error format.

## References
- See DS04 for semantics and runtime interpretation rules.
- See DS05 for testing coverage of syntax and validation.
- See DS07 for error code definitions.
