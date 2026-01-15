# DS26 - Deep Evaluation Suites (External NLP/LLM Benchmarks)

## Summary
Defines **Deep Evaluation Suites**: importing public NLP/LLM benchmark datasets (typically hosted on Hugging Face) and evaluating CNL-PL by:
1) translating dataset examples into **CNL theories + CNL commands**, and
2) executing them using **CNLSession**, producing pass/fail/skip metrics, plus a detailed failure report.

Deep evals are distinct from unit tests (DS05) and from the internal eval suites (DS06). They are intended to measure:
- real-world robustness of our reasoning + command execution,
- translation coverage (how much of a benchmark we can represent in CNL),
- regression tracking over time.

## Goals
- Keep evaluation deterministic and fully reproducible from repository state.
- Cache datasets under `evals/deep/<suite>/data/` so CI and local runs do not depend on runtime network access.
- Provide a transparent, auditable translation layer per dataset suite.
- Generate a detailed markdown report of failures, including:
  - the original dataset snippet,
  - the generated CNL,
  - what we expected vs what we got.

## Non-Goals
- Solving arbitrary natural-language understanding end-to-end.
- Automatically learning missing background knowledge from text.
- Supporting datasets where the correct answer depends on implicit open-world assumptions.

## Directory Layout
Deep evals live under:
- `evals/deep/<suite-id>/`
  - `suite.mjs` - suite metadata + loader + translator
  - `translate.mjs` - suite-specific translation logic
  - `fixtures.jsonl` - small in-repo fallback examples (must be deterministic)
  - `data/` - downloaded dataset files (not required to be checked into git, but supported)

Results:
- `evals/results/<timestamp>_deepcheck.md`

## Execution Model
Each translated test case executes in a fresh session:
- create `new CNLSession({ baseEntrypoint })` (DS12/DS14)
- `learnText(cnlTheory)` to load facts/rules
- execute the command via the appropriate pragmatic method:
  - `query`, `proof`, `explain`, `plan`, `solve`, `simulate`, `optimize`

The runner records:
- `PASS` if actual output matches the expected output
- `FAIL` if the session returns an error or outputs do not match
- `SKIP` if the dataset example cannot be represented under current translation constraints
  (example: tri-valued answers like `unknown` when the engine is currently bi-valued)

## Benchmark Selection Criteria
Prefer datasets that:
- have constrained templates and/or already “logic-like” language,
- have explicit ground truth for answers,
- can be represented using monotonic rules and deterministic commands.

Avoid datasets that:
- require external world knowledge not modeled in the dataset,
- rely on nuanced pragmatics or ambiguous semantics.

## Initial Supported Suites (v1)
This DS introduces the initial set of deep suites supported by `runDeep.mjs`:

### Suite: bAbI (Task 1 - Single Supporting Fact, Location)
Focus:
- tracking entity location through simple movement sentences
- answering “Where is X?” questions

Translation strategy:
- map movement sentences to `X is located in Place.`
- ask `Return the name of every place that X is located in.`

### Suite: ProofWriter (Depth-0 / Depth-1 subset)
Focus:
- logic-style facts and Horn rules expressed in restricted English
- yes/no questions for provable facts

Translation strategy:
- normalize “If ... then ...” sentences into CNL rules
- normalize “X is a Y.” facts directly into CNL
- handle answers:
  - `yes` → expected `ProofResult true`
  - `no` → expected `ProofResult false`
  - `unknown` → SKIP until tri-valued semantics are defined in DS04/DS11

## Reporting
`runDeep.mjs` produces a report in `evals/results/` containing:
- suite-by-suite summary (% passed, % failed, % skipped)
- for each failed case:
  - suite + case id
  - original example (trimmed JSON)
  - generated CNL theory + command
  - expected vs actual result
  - any session/compiler errors

## CLI
`runDeep.mjs` supports:
- `--suite <id>` (repeatable): run only selected deep suites.
- `--maxCases <n>`: limit translated test cases per suite (debugging).
- `--download`: allow suites to download missing dataset files into `evals/deep/<suite>/data/` (when suite modules define download sources).

## Operational Notes (Network)
Deep evals are designed to run offline once datasets are cached.
If a suite’s `data/` folder is empty, the runner may:
- fall back to `fixtures.jsonl`, and/or
- mark the suite as skipped with a clear message.

Downloading datasets from Hugging Face is intentionally explicit and cached into `evals/deep/<suite>/data/`.

## References
- DS06 for internal evaluation suite structure.
- DS12 for session lifecycle and diagnostics.
- DS14 for base theory loading.
- DS18 for proof trace expectations (when suites start requiring proof artifacts).
