# DS16 - Plan IR (Set, Relation, and Constraint Plans)

## Summary
Defines the plan intermediate representation used by the compiler to describe queries, rules, proofs, and action preconditions. Plans are typed, deterministic, and executable against the compiled KB without re-parsing.

## Scope
- Plan value types and operators.
- SetPlan and RelationPlan operators.
- Constraint nodes for comparisons.
- RulePlan and ActionPlan structure.

## Plan Value Types
- `SetPlan`: produces a Bitset of EntityID.
- `BoolPlan`: produces a boolean.
- `NumberPlan`: produces a numeric value.
- `RelationPlan`: produces a virtual relation as rows of Bitsets.

## SetPlan Operators
```
AllEntities()
UnarySet(unaryId)
EntitySet(entityId)
Intersect(plans[])
Union(plans[])
Not(plan, universe)
Image(predId, subjectSet)
Preimage(predId, objectSet)
NumFilter(attrId, comparator, value)
AttrEntityFilter(attrId, valueSet)
```

`Not` must use an explicit universe set to avoid implicit complements.

## RelationPlan Operators
```
BaseRelation(predId)
RestrictSubjects(relationPlan, subjectSet)
RestrictObjects(relationPlan, objectSet)
Compose(relationPlanA, relationPlanB)
```

`Compose(A, B)` yields a relation R where R[x] = OR over y in A[x] of B[y].

## BoolPlan Operators
```
Exists(setPlan)
IsEmpty(setPlan)
Compare(numberPlanLeft, comparator, numberPlanRight)
```

`Compare` uses BaseDictionary comparator allowances when present.

## NumberPlan Operators
```
AttrValue(attrId, subjectId)
Aggregate(op, setPlan, attrId?)
```

`Aggregate` supports NumberOf, SumOf, AverageOf, TotalOf as defined in DS04.

## RulePlan
```
RulePlan {
  body: SetPlan | RelationPlan | BoolPlan
  head: UnaryEmit | BinaryEmit | AttrEmit
}
```

Emit forms:
```
UnaryEmit { unaryId, subjectSet }
BinaryEmit { predId, relationPlan }
AttrEmit { attrId, subjectSet, valueExpr }
```

RulePlan execution must be idempotent and report newly added facts for delta evaluation.

## ActionPlan
```
ActionPlan {
  precondition: BoolPlan | SetPlan
  effects: EffectOp[]
}

EffectOp =
  AddUnary(unaryId, subjectSet)
  RemoveUnary(unaryId, subjectSet)
  AddBinary(predId, relationPlan)
  RemoveBinary(predId, relationPlan)
  SetNumeric(attrId, subjectSet, valueExpr)
```

## Determinism Requirements
- Plans store only IDs, never raw text.
- Plan serialization must preserve operator order and operand order.
- No rewrite rules are applied during execution.

## References
- DS09 for KB layout and bitset operations.
- DS11 for reasoning primitives.
- DS15 for compiler contract.
