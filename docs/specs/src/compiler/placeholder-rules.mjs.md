# placeholder-rules.mjs

## Summary
Compiles a small set of `Rule:` conditional sentence templates that use single-letter placeholders (`X`, `Y`, `Z`) into executable rule plans.

## Supported Templates
- Binary composition: `X R Y and Y S Z -> X T Z` (RelationRulePlan via `compose`)
- Binary inverse: `X R Y -> Y S X` (RelationRulePlan via `inverse`)
- Binary copy: `X R Y -> X S Y` (RelationRulePlan)
- Binary-to-unary typing helpers: `X R Y -> X is a c` and `X R Y -> Y is a c` (RulePlan via `preimage`/`image`)
- Unary typing helpers: `X is a c -> X is a d` (RulePlan)

## Non-Goals
- General multi-variable unification or arbitrary joins outside the supported patterns.

