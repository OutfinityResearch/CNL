# DS01 - Vision

## Summary
CNL-PL (Controlled Natural Language Programming Language) is a deterministic, formal language that reads like English but maps to a unique logical AST. The core goal is to make natural-language-like input executable without ambiguity or hidden heuristics.

## Problem Statement
Natural language is expressive but ambiguous. Traditional formal languages are precise but hard to read for non-experts. CNL-PL targets a middle ground: strict, explicit syntax with a readable surface form and deterministic parsing.

## Goals
CNL-PL is designed to:
- Produce exactly one AST for every valid sentence.
- Provide a stable grammar that multiple pragmatic engines can share.
- Keep input readable for non-experts while preserving formal rigor.
- Allow the grammar to be extended without breaking existing programs.

Example of the intended balance:
```
Every user who is active and who knows python is an admin.
```
This is readable, but still deterministic because relative pronouns are explicit and the predicate types are fixed.

## Non-Goals
CNL-PL explicitly does not attempt to:
- Parse free-form English or infer meaning from context.
- Apply implicit precedence rules for boolean logic.
- Resolve meaning through hidden heuristics or probabilistic guessing.

## User Experience and Learning Curve
CNL-PL requires more explicit structure than conversational English, but it remains readable:
- Boolean grouping must be explicit (parentheses or both/either/neither), so there is no hidden precedence.
- Noun phrases are explicitly marked with determiners or quantifiers, which avoids Name/NP ambiguity.
- Errors are expected to be precise and instructional, pointing to the exact location and a clear fix.

The intent is that an engineer can write CNL-PL with confidence that the parser will not guess.

## Pragmatics (Execution Modes)
CNL-PL supports multiple pragmatic modes that share the same syntax and AST:
- Query: retrieve entities or attributes from a KB.
- Proof: check derivability and return proof traces.
- Plan: produce an action sequence that achieves a goal.
- Solve: bind variables to satisfy constraints.
- Simulate: apply transition rules over time.
- Optimize: maximize or minimize objectives.
- Explain: return a justification chain for derived facts.

Each mode is separate, but they operate over the same compiled KB and rule plans.

## Success Criteria
A release meets the vision when:
- Every valid sentence yields a single AST or a single clear error.
- Mixed boolean operators are rejected unless explicitly grouped.
- Specs and tests cover grammar, determinism, compilation, and pragmatics.
- Documentation is readable by engineers who do not specialize in NLP.

## Design Principles
- Fixed triplet structure for atomic assertions (subject + typed predicate).
- Explicit grouping (parentheses or both/either/neither).
- Deterministic parsing from syntax alone, without semantic guessing.

## Stakeholders
- Language designers and implementers.
- Tooling and parser developers.
- Users modeling logic, constraints, or planning problems.
