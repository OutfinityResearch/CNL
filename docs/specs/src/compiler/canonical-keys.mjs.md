# src/compiler/canonical-keys.mjs

## Purpose
Provides canonical key generation so that compilation and plan building use the same ConceptualID keys. This keeps literal objects and attributes consistent between KB facts and plan filters.

## Responsibilities
- Build canonical entity keys for Names and literals.
- Build canonical attribute keys for AttributeRef and AttrSelector nodes.
- Normalize literal keys with explicit type tags to avoid collisions with Names.

## Key Format
- Name: `E:<Name>`
- Number literal: `E:lit:num:<value>`
- String literal: `E:lit:str:<value>`
- Boolean literal: `E:lit:bool:true|false`

Attribute keys:
- AttributeRef core only: `A:<core>`
- AttributeRef with PP: `A:<core>|<prep>:<object>`
- AttrSelector: `A:<words>`

## Determinism
Keys depend only on AST node kinds and values. No heuristics or text rewrite are applied.
