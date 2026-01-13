# DS14 - Base Theories (Common Sense Core)

## Summary
Defines the base theories shipped with CNL-PL: a small, deterministic set of CNL files that introduce a conservative "common sense" vocabulary (via BaseDictionary) plus a minimal set of monotonic axioms (rules). These theories are intended to be safe defaults and optional building blocks.

## Scope
- Base theory goals and constraints.
- Module layout and load order.
- Separation between dictionary declarations and factual axioms.
- Versioning and extension rules.
- Session autoload behavior and opt-out.

## Goals
- Provide a minimal shared vocabulary for entities, types, and relations.
- Stay monotonic (Horn-like rules only; no procedural semantics).
- Avoid defaults, probabilistic assumptions, or cultural bias.
- Keep modules orthogonal and independently loadable.
- Keep axioms conservative and easy to audit.

## Repository Layout
The base bundle is kept deliberately simple and explicit:
- `theories/base.cnl`

`theories/base.cnl` contains:
- BaseDictionary vocabulary under `--- CONTEXT: BaseDictionary ---`
- Minimal “common sense” axioms in normal contexts (`CoreTypes`, `Time`, etc.)
- Optional `Load: "<path>".` directives to include selected vendored ontology imports (DS22)

## Dictionary vs Theory Files
- Dictionary declarations use `--- CONTEXT: BaseDictionary ---` (DS13).
- Theory files use normal contexts such as `--- CONTEXT: CoreTypes ---`.
- Dictionary files are loaded first; theory files can depend on declared keys.

## Session Autoload
By default, a new `CNLSession` auto-loads the base bundle (dictionary + all base theory modules).
This behavior can be disabled via session options:
- `autoloadBase: false`

The autoload is intended to ensure:
- examples are not forced to restate generic scaffolding (typing helpers, basic relations)
- KB Explorer starts from the same audited baseline in every tab/session

Base theory axioms are authored using:
- universal-NP rules (`Every ...`)
- placeholder rule templates (`Rule: If X ... then ...`) as defined in DS10

## Core Modules (Definitions)
### Base Dictionary (Vocabulary)
The BaseDictionary declares arities, types, and domain/range constraints.

Design notes:
- Dictionary keys are string literals (DS13).
- Type keys are concept-like (lowercase; hyphenated compounds).
- Binary predicate keys are surface forms; they are normalized internally using pipe separators (DS13).

### Core Types (Typing Closure)
Provides conservative typing closure rules:
- `person -> agent -> entity`
- `object/place/organization/event/time-point/claim -> entity`

### Core Relations (Mereology + Containment)
Provides conservative structure rules:
- transitivity of `part of`
- containment implication: `inside of -> located in`

### Time (Ordering)
Provides a minimal ordering vocabulary and algebraic rules:
- inverse relationship between `prior to` and `subsequent to`
- transitivity for both relations

### Space (Structure)
Provides minimal spatial structure:
- transitivity of `inside of`
- symmetry of `adjacent to`

### Agency (Typing Helpers)
Adds typing helpers to reduce boilerplate in domain theories:
- `X performs Y -> X is an agent` and `Y is an event`
- `X intends Y -> X is an agent` and `Y is an event`
- `X causes Y -> X and Y are events`
- `X affects Y -> X is an event` and `Y is an entity`

### Epistemic (Typing Helpers)
Adds a small, generic "epistemic" vocabulary used by examples and many domains:
- `X believes Y -> X is an agent`
- `X asserts Y -> X is a claim`

## Universality Table
Base theories should only include commitments that are:
- monotonic and deterministic
- generic enough to be shared across most domains
- easy to audit and remove if a project chooses a different modeling decision

| Module | Commitment | Rule Form | Rationale |
| --- | --- | --- | --- |
| CoreTypes | `person -> agent -> entity` | unary typing | definitional type hierarchy |
| CoreTypes | `object/place/... -> entity` | unary typing | definitional: all are entities |
| CoreRelations | `part of` transitive | binary closure | standard mereology assumption |
| CoreRelations | `inside of -> located in` | binary-to-binary | containment implies location-in |
| Time | `prior to <-> subsequent to` | inverse mapping | definitional inverse naming |
| Time | transitivity of ordering | binary closure | standard partial-order modeling |
| Space | `inside of` transitive | binary closure | nested containment |
| Space | `adjacent to` symmetric | binary closure | adjacency is undirected by definition |
| Agency | typing from action predicates | unary typing | reduce boilerplate; conservative |
| Epistemic | typing from belief/claim predicates | unary typing | reduce boilerplate; conservative |

## Common Sense Domains
Base theories should cover these domains at minimum:
- Identity and typing (entity, object, agent, person, place, event).
- Composition and part-whole (`part of`).
- Location and containment (`located in`, `inside of`).
- Time and ordering (`prior to`, `subsequent to`, `happens during`).
- Possession and membership (`owns`, `member of`).
- Roles and attribution (project-specific; not mandated by the base bundle).
- Causation and effect (causes, affects).

Note: domain coverage is about providing a vocabulary surface. It does not imply that every domain needs axioms beyond typing and minimal structural closure.

## Load Order
1. Dictionary files.
2. Core type axioms.
3. Relations and domain modules.

Load order must be explicit when multiple base modules are used.

## Non-Goals
- Non-monotonic defaults (e.g., "birds normally fly").
- Probabilistic knowledge or weights.
- World knowledge that depends on culture or context.

## Semantic Web Alignment (Optional)
It is feasible to align or import parts of well-known Semantic Web ontologies (RDFS/OWL) into CNL-PL, but only under a strict subset:
- Prefer **RDFS** and **OWL-RL**-compatible fragments that compile into Horn-like rules.
- Avoid OWL constructs that require existential reasoning, inverse-functional semantics, or full open-world entailment.

Potential mapping sketch (subset):
- `rdfs:subClassOf(C, D)` -> `Rule: If X is a C, then X is a D.`
- `rdfs:subPropertyOf(P, Q)` -> `Rule: If X P Y, then X Q Y.`
- `rdfs:domain(P, C)` / `rdfs:range(P, C)` -> BaseDictionary domain/range constraints.

If ontology import is added, it should:
- cache ontology sources in-repo (no runtime network dependency)
- provide a deterministic translation with stable naming (DS03 naming conventions)
- be versioned and auditable like base theories

See DS22 for the importer tool, output layout (`.generated` + `.extra`), and supported construct subset.

## Versioning
Base theories are versioned as CNL files with semantic version tags in filenames or headers.
Changes must preserve determinism and keep old versions loadable.

## References
- DS03 for syntax and context directives.
- DS10 for compilation and grounding rules.
- DS13 for dictionary declarations.
- DS12 for session autoload options.
