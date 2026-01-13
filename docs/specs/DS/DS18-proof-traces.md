# DS18 - Proof Traces (Answer + Derivation)

## Summary
This document defines the proof-trace contract returned by CNL-PL when answering queries, proofs, solves, plans, simulations, and explanations. The goal is to return both the *answer* and a deterministic *derivation* that reflects the reasoning used to obtain that answer.

## Goals
- Provide an explicit reasoning trace for answers (not just `true/false` or a list of entities).
- Keep traces deterministic and stable across runs for the same input and KB state.
- Reuse existing provenance (justification store) when available.
- Provide best-effort witnesses for set-plan based results (query/solve) even when full provenance is not available.

## Non-Goals (v1)
- Full natural-deduction style proofs for arbitrary negation (NOT) and absence-of-fact explanations.
- Minimal proof optimality guarantees (shortest/cheapest proof) beyond deterministic ordering.
- Complete planning search tree dumps.

## ProofTrace Object
Every command result may include a `proof` field.

```
{
  kind: "ProofTrace",
  mode: "Derivation" | "Witness" | "Universal" | "PlanSearch" | "Simulation",
  conclusion: string,                 // the user command or a normalized proposition
  answerSummary: string,              // human summary (e.g. "true", "['A']", "satisfied")
  steps: string[],                    // ordered list of explanation steps
  premises?: string[],                // optional list of base facts (CNL sentences)
  counterexample?: {                  // optional, mainly for universal false
    entity: string,
    note?: string
  }
}
```

### Determinism Rules
- Order `steps` and `premises` deterministically:
  - Prefer ascending dense IDs for chosen witnesses.
  - Deduplicate identical sentences.
  - When multiple witnesses exist, choose the smallest witness ID.
- Avoid depending on object iteration order of `Map`/`Set` unless explicitly sorted.

## Trace Modes

### Derivation (Atomic Fact)
Used for answers based on a single ground unary or binary fact.

The trace should include:
- The conclusion fact as a CNL sentence.
- If the fact is base: mark it as stated.
- If derived: list the applied rule (by RuleID and, if possible, a natural language rendering) and recursively list the premise facts.

Example (classic syllogism):
```
Input theory:
  Socrates is a man.
  Every man is mortal.

Command:
  Verify that Socrates is mortal.

ProofTrace.steps (sketch):
  Socrates is a mortal.
    applied rule #0: Every man is mortal.
    Socrates is a man. (stated).
```

### Witness (Set Membership)
Used for query/solve results that return entities.

The trace should include:
- A list of returned entities (possibly truncated).
- For each returned entity (up to a fixed limit), a witness list:
- Unary membership facts (`X is a user.`)
  - Binary witness facts for relation filters (`X hosts Database_1.`)
  - Numeric witnesses for numeric filters (`X has a capacity of 1000.`)
- Entity-valued attribute witnesses (`X has a role of admin.`)

If provenance exists for a witness fact, it should be expanded using `Derivation` steps.

### Universal (Quantified Proof)
Used for `Verify that every ...` forms.

- If `true`: the trace should explain that there are no counterexamples (optionally listing the evaluated domain).
- If `false`: include one counterexample entity and a note that the consequent is not derivable for that entity.

### PlanSearch
Used for `Plan to achieve ...`.

- If satisfied immediately: explain that the goal already holds.
- If satisfied via steps: list the action steps and for each step show that preconditions held at application time.

### Simulation
Used for `Simulate N steps`.

- List which transition rules fired at each step (when applicable).
- Provide final-state summary and relevant derived facts when requested.

## Provenance Requirements
To support meaningful traces across features:
- Unary and binary facts MUST record base and derived justifications (existing DS11/DS15 behavior).
- Numeric and entity-valued attribute facts SHOULD record base and derived justifications:
  - Base attribute assertions are recorded as base facts.
  - Attribute emissions from rules record derived facts with premise references.

## Integration Points
- `CNLSession.execute/query/proof/solve/plan/simulate/optimize/explain` may attach `proof` to results.
- The KB Explorer API returns `proof` alongside `result`.
- UI renders the answer and a collapsible proof panel.

## Related Specs
- DS11 for justifications and provenance.
- DS15 for compiler and rule emission.
- DS17 for Knowledge Explorer presentation.
