# evals/parsing/base-dictionary.cases

## Summary
Covers BaseDictionary context declarations, ensuring the parser accepts string-literal keys and the expected sentence forms.

## Scope
- Predicate declarations (unary/binary).
- Domain and range declarations.
- Attribute typing and cardinality.
- Comparator allowances.
- Type and subtype declarations.

## Expectations
Each case should parse into a Program with a ContextDirective and a Statement.
AST hashes are placeholders until the parser snapshots are stabilized.
