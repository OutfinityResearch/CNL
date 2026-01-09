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
- Source map: theory file -> list of asserted facts and rules.

## Session Options
- `projectEntityAttributes`: when true, entity-valued attributes are also projected into derived binary predicates `has_attr|<AttrKey>`.

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

## Pragmatic Methods
- `query`: returns a Bitset of EntityID plus optional projection.
- `proof`: returns boolean plus optional justification trace.
- `explain`: returns a minimal justification DAG.
- `solve`: returns variable bindings or partial domains.
- `plan`: returns action sequence signatures.
- `simulate`: returns state snapshots over time.
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
