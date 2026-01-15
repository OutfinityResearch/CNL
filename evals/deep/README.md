# Deep Evals

This folder contains *deep* evaluation suites sourced from public NLP/LLM benchmarks.

Each suite is responsible for:
- ensuring cached dataset examples exist under `evals/deep/cache/<suite-id>/` (downloaded once, then reused),
- translating examples into CNL (`theory` + `command`),
- defining expected outputs, and
- reporting failures with generated CNL + actual results.

Some dataset constructs may be skipped when they cannot be represented without semantic drift (e.g., rules that depend on true existential variables).

Run:
- `node runDeep.mjs`
- `node runDeep.mjs --help`

Results are written to `evals/results/<timestamp>_deepcheck.md`.
