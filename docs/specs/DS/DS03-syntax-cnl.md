# DS03 - Syntax (CNL-PL v1.1)

## Summary
This document defines the deterministic, syntax-only contract for CNL-PL. It specifies the lexical rules, grammar, and the lossless AST shape that the parser must produce. There is no semantic interpretation here; DS04 and DS15 cover meaning and compilation.

## Scope
- Syntax only (no semantic or runtime meaning).
- Deterministic parsing with explicit disambiguation rules.
- Lossless AST suitable for tooling and serialization.

## Lexical Rules
### Tokens
- Words (IDENT): `[A-Za-z_][A-Za-z0-9_-]*`
- Numbers: integers or decimals
- Strings: double-quoted with escape sequences
- Variables: `?` followed by IDENT (example: `?X`, `?entity_1`)
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
3. Noun phrases must start with a determiner or quantifier; bare identifiers become Names only when they match the Thing/Name convention (see below).
4. `has` is disambiguated by a strict rule: it is possessive only when followed by a determiner.

These rules are enforced by validation errors (see DS07).

## Noun Phrases and Names
A noun phrase (NP) is a structured term used for subjects or objects.

### Things vs Concepts (Naming Convention)

**Things (Entities)** are individuals with unique identity in space and time:
- Written with Capital letter or with underscores: `Socrates`, `John`, `Server_A`, `my_car`
- Represent specific, identifiable objects: a person, a specific machine, a named location
- Examples: `Alice`, `Bob`, `Database_1`, `Region_A`

**Concepts (Categories)** are abstract classes without individual identity:
- Written in lowercase: `man`, `mortal`, `user`, `server`, `robot`
- Represent types, properties, or substances
- Examples: `water`, `package`, `hot`, `cold`, `admin`

**Compound concepts** SHOULD use hyphens to form a single identifier token (avoids quotes):
- `non-guest` (not `NonGuest`)
- `traffic-light` (not `TrafficLight`)
- `flat-earth` (not `FlatEarth` or `"flat earth"`)

**Important:** Articles and quantifiers (`a/an/the/every/...`) are grammar markers. They are not part of a Thing's identity.
Avoid encoding articles inside Names (for example `the_robot`). Use a real Name when you mean a concrete individual (for example `Robot_1`),
and use a noun phrase when you mean a set (for example `the robots`, `every robot`).

**Rule (intended):**
- A bare identifier token that starts with a capital letter (or otherwise uses a Name-like convention) is parsed as a Thing (proper name).
- A noun phrase head (the `core` of a noun phrase) denotes a Concept (unary predicate), and is typically lowercase (possibly hyphenated).
- Words after `is a/an` are parsed as Concepts.

```cnl
// Correct:
Socrates is a man.           // Socrates = thing, man = concept
Every man is mortal.         // man, mortal = concepts
Alice is an admin.           // Alice = thing, admin = concept
Robot_1 is a robot.          // Robot_1 = thing (named instance), robot = concept
Water_1 is water.            // Water_1 = thing (instance/sample), water = concept (substance)

// Incorrect:
Water is a Thing.            // Water should be lowercase (it's a substance, not an individual)
TrafficLight is Red.         // Should be: Light_1 is a traffic-light. Light_1 is red.
```

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

**Design note:** The determiner `the` does not create or name an entity. `the water` is a noun phrase that selects a set of entities that satisfy
the concept `water`. If you need a specific individual water instance, use a Name such as `Water_1` and relate it to concepts via `is a/an`.

### Thing Names vs Symbol Names
The grammar treats any bare IDENT as a `Name` node in the AST, but naming conventions are part of the surface syntax contract:
- **ThingName**: looks like an individual identifier (starts with an uppercase letter, or contains digits/underscores). Examples: `Socrates`, `Server_A`, `Package_1`.
- **SymbolName**: looks like a concept token (lowercase/hyphenated), used as a reified symbol in positions where a Name is required (for example as an object of a relation or as an entity-valued attribute value). Examples: `pizza`, `flat-earth`, `admin`.

SymbolNames are not "things in space and time"; they are symbolic constants that represent concepts. Tooling (KB Explorer) should display them with the
concept styling rather than as Things (see DS17). Internally they may be stored using a distinct key prefix (for example `L:<symbol>` in addition to `E:<thing>`).

### Implicit Noun Phrases (Aggregation Only)
Aggregation sets may use a bare head noun:
```
The number of packages is greater than 10.
```
The parser canonicalizes `packages` into an implicit noun phrase equivalent to `the packages`.

### Multi-Word Noun Heads
Noun phrase heads are a single word unless quoted. Multi-word heads must be written as a quoted string:
```
A "critical server" is monitored.
The "heavy truck" is assigned to Depot_7.
```

Prefer hyphenated forms when possible (single IDENT token):
```
A critical-server is monitored.
The heavy-truck is assigned to Depot_7.
```

### Variables
Variables are written with a leading `?` and represent entity slots in Solve/Optimize constraints:
```
Solve for ?X such that ?X is a user.
Solve for ?X and ?Y such that ?X manages ?Y.
```
Variables are not permitted in learned statements; they are only allowed in Solve and Optimize commands.

## Relative Clauses
Relative clauses must be explicit and cannot omit the pronoun. Each clause in a chain repeats the pronoun.

Valid:
```
A user who is active and who knows python.
```
Invalid:
```
A user who is active and knows python.
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

**Note:** `does not contain` is a comparator phrase. Other uses of `does not` are reserved for *active relation negation* (see below) and must not be parsed as comparators.

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

### Active Relation Negation (`does not`)
Active relations support an explicit negation form:
```
X does not manage Y.
every user that does not manage Server_A is active.
```
This is distinct from negation-as-failure (`it is not the case that ...`).

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
- `it is the case that` / `it is not the case that`

Invalid without grouping:
```
A or B and C.
```

## Top-Level Forms
- Statements end with `.`
- `Rule:` and `Command:` lines end with `.`
- `When ... occurs, then ...` is a transition rule.
- Action blocks are multi-line with labels: `Action:`, `Agent:`, `Precondition:`, `Effect:`.
- Context directives mark dictionary or theory segments: `--- CONTEXT: Name ---`.

## Command Forms
- `Return <expr>.`
- `Verify that <condition>.`
- `Find <expr> such that <condition>.`
- `Solve for <expr> [such that <condition>].`
- `Simulate <number> steps.`
- `Maximize <expr> such that <condition>.`
- `Minimize <expr> such that <condition>.`
- `Explain why <condition>.`
- `Plan to achieve <condition>.`

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
