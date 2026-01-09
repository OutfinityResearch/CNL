# ast-to-plan.mjs

## Summary
Compiles AST nodes into Plan IR fragments (SetPlan, RelationPlan, BoolPlan, NumberPlan).

## Responsibilities
- Compile noun phrases with relative clauses into SetPlans.
- Compile conditions into boolean/set plans without rewrites.
- Compile rule bodies and heads into RulePlan structures.
- Compile command nodes into executable plans.

## Notes
- Rule heads are emitted as UnaryEmit/BinaryEmit/AttrEmit objects aligned with DS16.

## Key Interfaces
- `compileNP(node)`
- `compileCondition(node, universePlan)`
- `compileRuleBody(node)`
- `compileRuleHead(node)`
- `compileCommand(node)`

## References
- DS15 for compiler contract.
- DS16 for Plan IR operators.
