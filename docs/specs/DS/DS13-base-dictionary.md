# DS13 - Base Dictionary (CNL Declarations)

## Summary
Defines the base dictionary as a CNL-marked theory that declares predicate arity, attribute typing, and type hierarchies. The dictionary is a compile-time constraint layer, not a fact store.

## Scope
- Dictionary context and allowed declaration forms.
- Predicate, attribute, and type declarations in CNL.
- Domain/range constraints and comparator allowances.
- Error conditions for missing or conflicting dictionary data.

## Dictionary Context
Dictionary files use a marked context:
```
--- CONTEXT: BaseDictionary ---
```

Within this context:
- Only dictionary declarations are allowed.
- Statements do not insert KB facts.
- All keys must be explicit string literals to avoid ambiguity.

## Declaration Forms (CNL)
The following forms are accepted inside the dictionary context.

### Predicate Declarations
```
"likes" is a binary predicate.
"active" is a unary predicate.
```

### Domain and Range
```
the domain of "likes" is "Person".
the range of "likes" is "Pizza".
```

### Attribute Declarations
```
"capacity" is a numeric attribute.
"status" is an entity attribute.
"capacity" is a functional attribute.
"tags" is a multivalued attribute.
```

### Comparator Allowances
```
the comparator of "capacity" is "greater than".
the comparator of "capacity" is "equal to".
```

### Type Declarations and Hierarchy
```
"Person" is a type.
"Driver" is a subtype of "Person".
```

## Compilation Rules
- Predicate declarations define PredID or UnaryPredID arity and canonical keys.
- Attribute declarations define value type and cardinality (functional vs multivalued).
- Domain/range declarations constrain validation when enabled.
- Comparator declarations are additive and restrict which comparisons are accepted in queries and rules.

If no dictionary is loaded, compilation falls back to AST predicate forms only.

## Validation and Errors
Dictionary errors are explicit:
- Predicate declared unary but used as binary.
- Attribute declared numeric but used with entity value.
- Comparator not allowed for a declared attribute.
- Domain/range violation when validation is enabled.
- Dictionary context contains a non-declaration statement.

## Versioning and Persistence
- Dictionary theories are versioned as CNL files and can be snapshot with the session.
- Dictionary updates do not retroactively mutate existing KB data.

## References
- DS03 for context directives and AST forms.
- DS08 for ConceptualID and interning.
- DS09 for KB storage layout.
- DS10 for compilation decisions that depend on dictionary data.
- DS12 for session options that load dictionary contexts.
