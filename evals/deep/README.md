# Deep Evals

This folder contains *deep* evaluation suites sourced from public NLP/LLM benchmarks.

Each suite is responsible for:
- loading cached dataset examples under `evals/deep/<suite>/data/` (if present),
- otherwise falling back to `fixtures.jsonl`,
- translating examples into CNL (`theory` + `command`),
- defining expected outputs, and
- reporting failures with generated CNL + actual results.

Run:
- `node runDeep.mjs`
- `node runDeep.mjs --help`

Results are written to `evals/results/<timestamp>_deepcheck.md`.

