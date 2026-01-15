# src/parser/grammar/expressions.mjs

## Purpose
Parses lower-level expressions, noun phrases, relative clauses, and attribute selectors.

## Responsibilities
- Parse literals: `NumberLiteral`, `StringLiteral`, `BooleanLiteral`.
- Parse variables (`?X`) and identifiers (`Name`).
- Parse aggregations: `NumberOf`, `SumOf`, `AverageOf`, `TotalOf`.
- Parse `NounPhrase` including determiners, quantifiers, adjectives (core words), and prepositional phrases.
- Parse `RelativeClause` structures ("who...", "that...", "where...", "whose...").
- Parse `VerbGroup` for active relations ("has successfully downloaded").

## Key Interfaces
- `parseExpr(stream)`
- `parseNounPhrase(stream)`
- `parseRelativeRestriction(stream)`: Handles AND/OR chains of relative clauses.
- `parseAttributeRef(stream)`: Parses attribute chains ("the weight of the package").

## References
- DS03 for Noun Phrase structure.
