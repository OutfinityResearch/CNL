# DS07 - Error Handling

## Summary
Defines the standard error object format and the canonical error codes for the CNL-PL lexer, parser, and validator.

## Standard Error Object
Every error should include at least:

```
{
  "code": "SYN011",
  "name": "MixedBooleanOperatorsError",
  "message": "Mixed 'and'/'or' without explicit grouping (both/either/neither/it is the case that/parentheses).",
  "severity": "error",
  "primaryToken": "or",
  "hint": "Rewrite using 'either ... or ...' or parentheses."
}
```

## Field Definitions
- `code`: stable error identifier.
- `name`: error type name.
- `message`: human-readable description.
- `severity`: `error` or `warning` (default `error`).
- `primaryToken`: the token at which the input becomes impossible to parse deterministically.
- `hint`: short suggestion for correction.
- `offendingField`: optional field label for block-level errors (for example `Action` or `Agent`).

## Lexical Errors
- LEX001 - InvalidCharacterError
  - Trigger: character outside the allowed alphabet or punctuation set.
  - PrimaryToken: the invalid character.
  - Hint: Use IDENT, NUMBER, or STRING tokens and permitted punctuation.

- LEX002 - UnterminatedStringError
  - Trigger: string starts with `"` but has no closing quote before EOF or line end.
  - PrimaryToken: the unterminated string fragment.
  - Hint: Close the string with `"`.

- LEX003 - KeywordAsIdentifierError
  - Trigger: reserved keyword used where IDENT is expected (name, noun core, verb).
  - PrimaryToken: the keyword.
  - Hint: Choose a different name.
  - Note: single-letter uppercase identifiers (A..Z) are allowed as Name tokens when the grammar expects a Name.

- LEX004 - InvalidNumberError
  - Trigger: invalid numeric format (for example `12.` or `01.2.3`).
  - PrimaryToken: the malformed number token.
  - Hint: Use `123` or `123.45`.

## Syntax Errors
- SYN001 - UnexpectedTokenError
  - Trigger: token is valid lexically but impossible in the current grammar position.
  - PrimaryToken: the current token.
  - Hint: Check the triplet structure, punctuation, and keyword order.

- SYN002 - UnexpectedEOFError
  - Trigger: EOF while required tokens are still expected.
  - PrimaryToken: EOF.
  - Hint: Complete the statement (missing object/comparator/etc.).

- SYN003 - MissingTerminatorError
  - Trigger: statement, command, or rule missing trailing `.`.
  - PrimaryToken: EOF or the next token after a complete statement.
  - Hint: Add a period at the end.

- SYN004 - InvalidParenthesesError
  - Trigger: unbalanced parentheses.
  - PrimaryToken: `)` or EOF.
  - Hint: Close parentheses or use explicit grouping forms.

- SYN005 - InvalidComparatorError
  - Trigger: comparator pattern starts but does not match canonical comparators.
  - PrimaryToken: the first token that breaks the comparator match.
  - Hint: Use `is equal to`, `is greater than`, `contains`, `does not contain`, etc.

- SYN006 - InvalidCommandFormError
  - Trigger: command recognized but required structure is missing.
  - PrimaryToken: token where parsing fails (for example `no`, `steps`).
  - Hint: Follow the command signature (such as `find ... such that`).

- SYN007 - TransitionRuleMissingOccursError
  - Trigger: `when <condition>` without `occurs`.
  - PrimaryToken: the token immediately after the condition.
  - Hint: Use `When <event> occurs, then <effect>.`

- SYN008 - HasFormDeterminismError
  - Trigger: `has` followed by a likely attribute without a determiner.
  - PrimaryToken: token immediately after `has`.
  - Hint: Use `has a <attribute> of <value>`.

- SYN009 - InvalidNounPhraseStartError
  - Trigger: noun phrase without determiner or quantifier.
  - PrimaryToken: first IDENT of the noun phrase.
  - Hint: Start with `a/an/the/every/all/no/some/at least/at most/another`.

- SYN010 - RelativePronounRepetitionError
  - Trigger: relative clause chain uses `and/or` without repeating the pronoun.
  - PrimaryToken: the verb after `and/or`.
  - Hint: Repeat the pronoun (`who ... and who ...`).

- SYN011 - MixedBooleanOperatorsError
  - Trigger: `and` and `or` appear at the same level without explicit grouping.
  - PrimaryToken: the operator that introduces the mix.
  - Hint: Use `either ... or ...`, `both ... and ...`, or parentheses.

- SYN012 - MixedRelativeBooleanOperatorsError
  - Trigger: mixed boolean operators inside relative restrictions without grouping.
  - PrimaryToken: operator that breaks the level.
  - Hint: Group explicitly with parentheses or either/both forms.

- SYN017 - InvalidQuantifierNumberError
  - Trigger: `at least` or `at most` missing a NUMBER.
  - PrimaryToken: the token where the number was expected.
  - Hint: Use `At least 2 users ...`.

## Structural Errors
- SYN013 - ActionBlockMissingRequiredFieldError
  - Trigger: missing `Action:` or `Agent:` in an action block.
  - OffendingField: `Action` or `Agent`.
  - Hint: A valid block must include both fields.

- SYN014 - ActionBlockDuplicateFieldError
  - Trigger: duplicate unique fields (`Action`, `Agent`, `Intent`).
  - Hint: Use one field and list multiple Preconditions/Effects instead.

- SYN015 - MissingColonAfterLabelError
  - Trigger: labels without a `:` immediately after (`Rule`, `Command`, `Action`, `Agent`, `Precondition`, `Effect`, `Intent`).
  - Hint: Use the exact `Label:` form.

- SYN016 - InvalidContextDirectiveError
  - Trigger: malformed `--- CONTEXT: Name ---` directive.
  - Hint: Use `--- CONTEXT: LogisticsNetwork ---` with valid IDENT.
