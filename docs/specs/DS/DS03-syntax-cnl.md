# DS03 - Syntax (CNL-PL v1.1)

## Summary
This document defines the deterministic, syntax-only contract for CNL-PL. It specifies the lexical rules, grammar, and the lossless AST shape that the parser must produce. There is no semantic interpretation here; DS04 and DS15 cover meaning and compilation.

## Scope
- Syntax only (no semantic or runtime meaning).
- Deterministic parsing with explicit disambiguation rules.
- Lossless AST suitable for tooling and serialization.

## Lexical Rules
### Tokens
- Words (IDENT): `[A-Za-z_][A-Za-z0-9_]*`
- Numbers: integers or decimals
- Strings: double-quoted with escape sequences
- Booleans: `true` and `false` (case-insensitive)
- Punctuation: `.`, `:`, `,`, `(`, `)`

### Whitespace and Comments
- Whitespace separates tokens.
- Line comments start with `//` and run to end of line.

### Keywords and Case
- Keywords are case-insensitive and reserved.
- Non-keyword words preserve original case in the AST.

### Controlled Prepositions
Only the following prepositions are allowed in verb particles and PP modifiers:
`of`, `to`, `at`, `in`, `on`, `with`, `for`, `from`, `into`, `between`, `among`,
`over`, `under`, `by`, `during`, `through`, `within`, `around`, `across`,
`about`, `after`, `before`, `without`.

## Determinism Rules (Critical)
CNL-PL rejects inputs that could be parsed in multiple ways.

1. Mixed `and` and `or` at the same level is invalid unless grouped.
2. Parentheses are permitted for explicit grouping of conditions.
3. Noun phrases must start with a determiner or quantifier; bare words become Names.
4. `has` is disambiguated by a strict rule: it is possessive only when followed by a determiner.

These rules are enforced by validation errors (see DS07).

## Noun Phrases and Names
A noun phrase (NP) is a structured term used for subjects or objects.

### Determiners and Quantifiers
Allowed NP starts:
- Determiners: `a`, `an`, `the`, `another`
- Quantifiers: `every`, `all`, `no`, `some`
- Numeric quantifiers: `at least <number>`, `at most <number>`

### Name Tokens
A Name is a single word token without a determiner. It represents a proper name or symbol.

Example:
```
Truck_A is assigned to Warehouse_7.
```
Here `Truck_A` and `Warehouse_7` are Names, not noun phrases.

### Implicit Noun Phrases (Aggregation Only)
Aggregation sets may use a bare head noun:
```
The number of packages is greater than 10.
```
The parser canonicalizes `packages` into an implicit noun phrase equivalent to `the packages`.

## Relative Clauses
Relative clauses must be explicit and cannot omit the pronoun. Each clause in a chain repeats the pronoun.

Valid:
```
A user who is active and who knows Python.
```
Invalid:
```
A user who is active and knows Python.
```

Relative clauses attach only to noun phrases. A bare Name followed by a relative pronoun is rejected.

## Predicate Templates (Typed Verb Phrases)
Predicates are not free text. Each atomic sentence uses one of the fixed predicate templates below.

### Copula + Comparator
```
X is greater than Y.
X was equal to Y.
```
Comparator phrases include:
- `equal to`, `not equal to`
- `greater than`, `less than`
- `greater than or equal to`, `less than or equal to`
- `contains`, `does not contain`

### Attribute Predicate (Possessive)
```
X has a capacity of 1000.
```
Rule: `has` is possessive only when followed by a determiner. The optional `of <value>` is allowed.

### Copula + Preposition (Passive Relation)
```
X is assigned to Y.
X is located at Y.
```

### Copula + Complement
```
X is valid.
X is a vehicle.
```

### Verb Group + Object (Active Relation)
```
X overlaps with Y.
X logs in today.
```
Verb groups may include prepositional particles (from the controlled preposition list).

## Atomic Sentence and Triplet Mapping
Every atomic sentence maps deterministically to a structured SVO triplet:
- Subject: a Term (Name, noun phrase, literal, or aggregation).
- VerbPhrase: a typed predicate record (not a plain string).
- Object: the complement or object term.

Example:
```
temperature is greater than 20.
```
Becomes:
- Subject: `temperature`
- VerbPhrase: `copula + comparator(gt)`
- Object: `20`

## Boolean Conditions
Conditions are boolean trees. There is no implicit precedence.

Allowed grouping patterns:
- Parentheses: `(A and B) or C`
- `both A and B`
- `either A or B`
- `neither A nor B`
- `it is the case that` / `it is not the case that`

Invalid without grouping:
```
A or B and C.
```

## Top-Level Forms
- Statements end with `.`
- `Rule:` and `Command:` lines end with `.`
- `When ... occurs, then ...` is a transition rule.
- Action blocks are multi-line with labels: `Action:`, `Agent:`, `Precondition:`, `Effect:`, `Intent:`.

Example action block:
```
Action: deliver package.
Agent: a driver.
Precondition: the package is ready.
Effect: the package is delivered.
```

## AST Requirements (High-Level)
- AST nodes preserve spans for diagnostics.
- Conditions preserve explicit structure (Either/Neither/Both/Group).
- Predicates are typed (copula, comparison, attribute, relation).
- Relative clauses carry an implicit subject reference to the NP head.

See DS15 for the compiler contract and the exact plan-level mappings.

## Validation Errors (Must Detect)
- Mixed boolean operators without explicit grouping.
- Missing sentence terminator `.`
- Ambiguous `has` usage.
- Invalid noun phrase start.
- Relative pronoun repetition errors.
- Action block missing required field.

See DS07 for the canonical error codes and standard error format.
