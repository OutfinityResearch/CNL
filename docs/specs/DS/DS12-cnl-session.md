# DS12 - CNLSession API and Lifecycle

## Summary
Defines the session-level API for loading .cnl theories, compiling them into the KB, and executing pragmatic operations (query, proof, explain, solve, plan, simulate, optimize).

## Scope
- Session state and lifecycle.
- `learn(theoryFile)` and text-based loading.
- Pragmatic API surface.
- Error reporting and diagnostics.

## Session State
CNLSession manages:
- Concept interners and dense ID maps (DS08).
- Compiled KB and indices (DS09).
- Rule plans and justification store (DS10, DS11).
- Optional base dictionary declarations (predicate/attribute typing).
- Source list: ordered CNL inputs used for transactional rebuilds.

## Session Options
- `projectEntityAttributes`: when true, entity-valued attributes are also projected into derived binary predicates `has_attr|<AttrKey>`.
- `validateDictionary`: when true, compiler enforces BaseDictionary constraints (arity, attribute types, comparators).
- `autoloadBase`: when true (default), session auto-loads the base bundle defined in DS14.
- `rootDir`: filesystem root used to resolve default base bundle paths (defaults to `process.cwd()`).

## Theory Directives (Preprocessor)
To keep theory bundles explicit while still allowing “include”-style composition and transparent vocabulary disambiguation, the session supports preprocessor directives that are expanded **before parsing** (see DS25/DS24):
- `Load: "<relative-or-absolute-path>".`
- `RenameType: "<from>" -> "<to>".`
- `RenamePredicate: "<from>" -> "<to>".`

Behavior:
- `Load:` directives are expanded recursively, preserving the same inlined order as if files were pasted at the directive site.
- Paths are resolved relative to `rootDir` by default, or relative to the current source file when using `./` or `../`.
- Cycles and repeated loads are rejected.
- Paths are restricted to stay within `rootDir`.
- `RenameType:` / `RenamePredicate:` directives are collected from all loaded files and applied to the expanded program **before compilation** (DS25).

This is used by `theories/base.cnl` to pull in selected vendored ontology imports (DS22).

### Load-time diagnostics
During theory loading, the session runs theory diagnostics (DS24) over the loaded file set and attaches resulting issues to:
- `session.state.dictionary.warnings`

This is what KB Explorer displays under `⚠️ issues`.
If rename directives were applied, the session attaches `LoadTimeRenameApplied` issues (DS24/DS25).

## Lifecycle
1. Initialize with optional dictionary and bitset implementation.
2. `learn(theoryFile)` parses, validates, compiles, and updates KB.
3. Pragmatic calls run against the current KB state.
4. Optional reset/snapshot for isolated runs.

## Core API (Pseudo)
```
session = new CNLSession(options)
session.learn(theoryFile, options)
session.learnText(cnlText, options)

session.execute(cnlText, options)
session.runProgram(cnlText, options)
session.query(cnlQuery, options)
session.proof(cnlStatement, options)
session.explain(cnlStatement, options)
session.solve(cnlConstraints, options)
session.plan(cnlGoal, options)
session.simulate(cnlScenario, options)
session.optimize(cnlObjective, options)

session.snapshot()
session.reset()
```

## learn(theoryFile)
- Accepts a .cnl file path.
- Parses with DS03 rules and validates DS07 errors.
- Compiles AST into KB updates and rule plans (DS10).
- Returns compilation diagnostics and a summary of inserted facts/rules.
- BaseDictionary contexts update the dictionary state and do not insert KB facts.

### learn options
```
{
  transactional: true,   // default: true
  incremental: false     // default: false
}
```

- Transactional loading: if any compilation error occurs, the KB is not mutated.
- Incremental loading: valid statements are applied, invalid statements are reported with source locations.
- Transactional and incremental are mutually exclusive; if both are requested, return an error.
  - Incremental parsing is line/block tolerant: a bad line does not prevent other statements from being compiled.

## Pragmatic Methods
- `execute`: routes text to learning or command execution (exclusive).
- `runProgram`: executes a mixed program (statements + commands) sequentially in-order.
- `query`: returns a list of entity bindings with display keys.
- `proof`: returns boolean plus optional justification trace.
- `explain`: returns a justification DAG and optional base fact summaries.
- `solve`: returns variable bindings (and, in v2, bindings supported by at least one consistent assignment); may attach proof traces (DS21/DS18).
- `plan`: returns ordered action steps and a plan proof trace (DS19/DS18).
- `simulate`: returns state snapshots over time (and optional simulation traces; DS20/DS18).
- `optimize`: returns best solution and objective value.

## Error Handling
- All methods return structured errors (DS07 format).
- Compilation errors never mutate the KB when `transactional` is enabled.
- Pragmatic errors return context (missing predicate, unbound variable, unsupported comparator).

## Determinism Guarantees
- Identical inputs in the same session yield identical ConceptualIDs, dense IDs, and results.
- Optional persistence is supported by serializing the interner and KB indices.

## References
- DS08 for ConceptualID and interning.
- DS09 for KB layout.
- DS10 for compilation.
- DS11 for reasoning primitives.
- DS13 for dictionary typing and validation.
- DS25 for vocabulary renames (directive-based load-time policy).
