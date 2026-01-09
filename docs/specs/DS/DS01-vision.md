# DS01 - Vision

## Summary
CNL-PL (Controlled Natural Language Programming Language) is a deterministic, formal language that looks like English but maps to a unique logical AST. The primary goal is to make natural language executable without ambiguity.

## Problem Statement
Natural language is expressive but ambiguous. Traditional formal languages are precise but hard to read. CNL-PL targets a middle ground: strict syntactic structure with human-readable surface forms.

## Goals
- Deterministic parsing for every valid sentence.
- A stable grammar that supports multiple pragmatic engines.
- Readability for non-expert users while preserving formal rigor.
- A grammar that can be extended without breaking existing programs.

## Non-Goals
- Free-form English understanding.
- Hidden precedence rules for boolean logic.
- Implicit semantic resolution without explicit syntax.

## Pragmatics (Execution Modes)
- Query: structured questions and retrieval.
- Proof: derivability and proof generation in CNL.
- Plan: action planning with preconditions and effects.
- Solve: constraint satisfaction and variable binding.
- Simulate: state machine evolution over steps.
- Optimize: maximize or minimize objectives.
- Explain: causal explanation for derived facts.

## Success Criteria
- Each sentence produces a single AST or a single, clear error.
- Mixed boolean operators are rejected unless grouped explicitly.
- Specs and tests cover core grammar, validation, and pragmatics.

## Design Principles
- Fixed triplet structure for assertions.
- Explicit grouping with both/either/neither or parenthesized grouping.
- Noun phrases start with determiners or quantifiers to separate names.

## Stakeholders
- Language designers and implementers.
- Tooling and parser developers.
- Users modeling logic, constraints, or planning problems.
