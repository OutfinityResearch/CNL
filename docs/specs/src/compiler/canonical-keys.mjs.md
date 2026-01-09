# src/compiler/canonical-keys.mjs

## Purpose
Provides canonical key generation for entity-like nodes so that compilation and plan building use the same ConceptualID keys. This keeps literal objects consistent between KB facts and plan filters.

## Responsibilities
- Build canonical entity keys for Names and literals.
- Normalize literal keys with explicit type tags to avoid collisions with Names.

## Key Format
- Name: `E:<Name>`
- Number literal: `E:lit:num:<value>`
- String literal: `E:lit:str:<value>`
- Boolean literal: `E:lit:bool:true|false`

## Determinism
Keys depend only on AST node kinds and values. No heuristics or text rewrite are applied.
