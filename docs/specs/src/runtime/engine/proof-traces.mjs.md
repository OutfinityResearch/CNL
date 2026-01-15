# src/runtime/engine/proof-traces.mjs

## Purpose
Builds structured proof objects (`ProofTrace`) for `Verify` commands.

## Responsibilities
- Handle negation logic (`not (A)`) by checking failure to derive A.
- Handle universal quantification (`Every X is Y`) by checking domain difference.
- Generate counterexamples for failed universal claims.
- Integrate with `explainAssertion` for atomic claims.

## Key Interfaces
- `buildProofTraceForVerify(command, state, ok)`

## Trace Modes
- `Negation`: "Negated claim is false because inner claim holds."
- `Universal`: "Found counterexample in domain."
- `Derivation`: Standard deductive trace.

## References
- DS18 for Proof Trace schema.
