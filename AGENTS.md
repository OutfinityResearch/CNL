# CNL Project Instructions

## Project Vision
CNL-PL is the Controlled Natural Language Programming Language. Its goal is to turn constrained natural language into a deterministic, executable logical representation.

## Documentation Structure
- `docs/index.html` is the presentation page for the project.
- `docs/theory/index.html`, `docs/architecture/index.html`, `docs/wiki/index.html`, `docs/syntax/index.html`, `docs/specs/index.html` are static HTML pages.
- All HTML pages share a common header and footer (same markup and navigation links).

## Design Specifications (DS)
Stored in `docs/specs/DS` with the naming pattern `DS01-short-name.md`:
- DS01: Vision
- DS02: Implementation plan and file mapping
- DS03: Syntax (grammar, lexical rules, AST)
- DS04: Semantics
- DS05: Automated testing plan
- DS06: Evaluation suite (parsing and reasoning)

## Mirrored Specs
- `docs/specs/src` mirrors `src` with file-level documentation using the same path plus `.md`.
- `docs/specs/tests` mirrors `tests` with descriptions of test files.
- `docs/specs/evals` mirrors `evals` with evaluation suite documentation.

## Language Rules
- All files created in this repository (code, comments, HTML, Markdown) must be written in English.
- Responses to user questions, reviews, and ad-hoc reports placed at the repository root must be in Romanian.
- Use JavaScript with `.mjs` modules for source and tests; do not use TypeScript.
- **No ASCII Diagrams**: All diagrams in HTML documentation must be rendered as SVGs. Do not use ASCII art in `<pre>` blocks for diagrams.
