# DS14 - Base Theories (Common Sense Core)

## Summary
Defines the base theories shipped with CNL-PL: a small, deterministic set of CNL files that introduce common sense concepts, types, and relations. These theories are intended to be safe defaults and optional building blocks.

## Scope
- Base theory goals and constraints.
- Module layout and load order.
- Separation between dictionary declarations and factual axioms.
- Versioning and extension rules.

## Goals
- Provide a minimal shared vocabulary for entities, types, and relations.
- Stay monotonic (Horn-like rules only).
- Avoid defaults, probabilistic assumptions, or cultural bias.
- Keep modules orthogonal and independently loadable.

## Repository Layout
Base theories live under:
- `theories/base/`

Proposed files:
- `theories/base/00-base-dictionary.cnl` (BaseDictionary context only)
- `theories/base/01-core-types.cnl`
- `theories/base/02-core-relations.cnl`
- `theories/base/03-time.cnl`
- `theories/base/04-space.cnl`
- `theories/base/05-agency.cnl`

## Dictionary vs Theory Files
- Dictionary declarations use `--- CONTEXT: BaseDictionary ---` (DS13).
- Theory files use normal contexts such as `--- CONTEXT: CoreTypes ---`.
- Dictionary files are loaded first; theory files can depend on declared keys.

## Core Modules (Definitions)
### Core Types
Defines foundational types and inheritance:
- Entity, Object, Agent, Person, Place, Organization, Event, TimePoint.
Example axiom:
- "Every person is an agent."

### Core Relations
Defines common binary relations without defaults:
- part_of, located_in, member_of, has_role, has_attribute, owns.
Rules are restricted to definitional or type-propagating rules.

### Time
Defines minimal temporal relations:
- before, after, during, overlaps.
May include axioms like:
- "If X is before Y, then Y is after X."

### Space
Defines minimal spatial relations:
- located_in, inside, adjacent_to.
Rules avoid geometric assumptions.

### Agency
Defines action-oriented relations:
- performs, intends, causes, affects.
Rules are minimal and do not encode planning policies.

## Common Sense Domains
Base theories should cover these domains at minimum:
- Identity and typing (entity, object, agent, person, place, event).
- Composition and part-whole (part_of).
- Location and containment (located_in, inside).
- Time and ordering (before, after, during).
- Possession and membership (owns, member_of).
- Roles and attribution (has_role, has_attribute).
- Causation and effect (causes, affects).

## Load Order
1. Dictionary files.
2. Core type axioms.
3. Relations and domain modules.

Load order must be explicit when multiple base modules are used.

## Non-Goals
- Non-monotonic defaults (e.g., "birds normally fly").
- Probabilistic knowledge or weights.
- World knowledge that depends on culture or context.

## Versioning
Base theories are versioned as CNL files with semantic version tags in filenames or headers.
Changes must preserve determinism and keep old versions loadable.

## References
- DS03 for syntax and context directives.
- DS10 for compilation and grounding rules.
- DS13 for dictionary declarations.
