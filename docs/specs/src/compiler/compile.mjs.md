# compile.mjs

## Summary
Top-level compiler entrypoint that transforms a deterministic AST into compiled artifacts: KB updates, plan stores, and provenance metadata.

## Responsibilities
- Validate AST structure and required contexts.
- Route BaseDictionary contexts to the dictionary compiler.
- Allocate ConceptualIDs and dense IDs via interners.
- Emit KB inserts for ground facts.
- Emit RulePlan, ActionPlan, and CommandPlan artifacts.
- Return a single CompiledArtifacts bundle.

## Key Interfaces
- `compileProgram(ast, options)`
- `compileStatement(node)`
- `compileRule(node)`
- `compileCommand(node)`
- `compileActionBlock(node)`

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
