# src/parser/grammar/constants.mjs

## Purpose
Defines the reserved vocabulary for the CNL parser.

## Responsibilities
- Export sets of reserved words: `PREPOSITIONS`, `RELATIVE_PRONOUNS`, `DETERMINERS`, `QUANTIFIERS`, `COPULAS`, `AUXILIARIES`.
- Export the master `KEYWORDS` set which restricts valid identifiers.

## Key Exports
- `KEYWORDS`: The set of all reserved tokens that cannot be used as names unless escaped (though escaping is not currently supported for keywords).
- `PREPOSITIONS`: Used for prepositional phrase attachment.
- `COPULAS`: Used for "is/are/was/were" predicates.

## References
- DS03 for the list of reserved words.
