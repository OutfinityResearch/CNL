# src/runtime/engine/ast-render.mjs

## Purpose
Reconstructs English text from AST nodes.

## Responsibilities
- Serialize `NounPhrase`, `Condition`, `Sentence`, `Assertion` back to strings.
- Used for logging, error messages, and trace summaries.
- Does not guarantee byte-for-byte fidelity with original source (whitespace normalization), but preserves semantics.

## Key Interfaces
- `renderNodeText(node)`
- `renderConditionText(condition)`
- `renderSentenceText(sentence)`

## References
- DS03 for AST structure.
