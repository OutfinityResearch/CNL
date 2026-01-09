# evals/reasoning/compiler.v1.json

## Summary
Compiler-level evaluation cases for KB summary counts derived from CNL inputs.

## Output Format
Each case expects a summary object:
- `unaryFacts`: total bits set in unary predicates.
- `binaryFacts`: total bits set in binary relations.
- `numericFacts`: number of subjects with numeric values.
- `entityAttrFacts`: total bits set in entity-valued attributes.
- `purpose`: short description of the scenario under test.

## Notes
These summaries validate compilation without executing rule inference.
