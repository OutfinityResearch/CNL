# compile.mjs

## Summary
Top-level compiler entrypoint that transforms a deterministic AST into compiled artifacts: KB updates, plan stores, and provenance metadata.

## Responsibilities
- Validate AST structure and required contexts.
- Route BaseDictionary contexts to the dictionary compiler.
- Allocate ConceptualIDs and dense IDs via interners.
- Emit KB inserts for ground facts.
- Compile universal quantified assertions into RulePlan bodies.
- Optionally project entity-valued attributes into derived predicates.
- Emit RulePlan, ActionPlan, and CommandPlan artifacts.
- Return a single CompiledArtifacts bundle.
- Enforce dictionary constraints when validation is enabled.

## Key Interfaces
- `compileProgram(ast, options)`
- `compileStatement(node)`
- `compileRule(node)`
- `compileCommand(node)`
- `compileActionBlock(node)`

## Non-ground Assertions
Assertions whose subject is a noun phrase are treated as rules only when the subject uses a universal quantifier (`every`/`all`). Other non-ground assertions emit a compiler error.

## Dependencies
- `src/ids/interners.mjs`
- `src/compiler/dictionary.mjs`
- `src/compiler/ast-to-plan.mjs`
- `src/kb/kb.mjs`
- `src/rules/store.mjs`
- `src/actions/store.mjs`
- `src/formulas/store.mjs`

## References
- DS15 for compiler contract.
- DS16 for Plan IR.
