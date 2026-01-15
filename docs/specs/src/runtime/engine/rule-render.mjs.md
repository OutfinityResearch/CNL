# src/runtime/engine/rule-render.mjs

## Purpose
Generates human-readable summaries of compiled rules for trace output.

## Responsibilities
- Decode `RuleID` to `RulePlan`.
- Convert compiled plans (`RulePlan`, `RelationRulePlan`) back into near-English text.
- Use `idStore` to resolve dense IDs to names.

## Key Interfaces
- `renderRuleSummary(ruleId, state)`: Returns a string (e.g., "If X is a man, then X is mortal.").

## References
- DS18 for Trace readability.
