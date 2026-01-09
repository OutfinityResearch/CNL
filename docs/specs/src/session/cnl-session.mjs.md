# cnl-session.mjs

## Summary
Session-level API for learning theories and executing pragmatics.

## Responsibilities
- Manage dictionary state, interners, and compiled KB.
- Provide `learn` with transactional or incremental behavior.
- Dispatch query/proof/solve/plan/simulate/optimize calls.
- Apply `projectEntityAttributes` when compiling entity-valued attributes.
- Enforce BaseDictionary constraints when `validateDictionary` is enabled.
- Execute command-only inputs via the runtime engine and optional rule materialization.

## Key Interfaces
- `learn(theoryFile, options)`
- `learnText(cnlText, options)`
- `query(cnlQuery, options)`
- `proof(cnlStatement, options)`
- `explain(cnlStatement, options)`

## References
- DS12 for session contract.
- DS15 for compiler contract.
