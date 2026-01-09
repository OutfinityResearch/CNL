# tests/validator/errors.test.mjs

## Purpose
Ensures each required validation error is triggered correctly.

## Expected Coverage
- MixedBooleanOperatorsError
- MissingTerminatorError
- HasFormDeterminismError
- InvalidNounPhraseStartError
- RelativePronounRepetitionError
- ActionBlockMissingRequiredFieldError

## Notes
- Error objects should follow DS07 and include code, name, primaryToken, and hint fields.
