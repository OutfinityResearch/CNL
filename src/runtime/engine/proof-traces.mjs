import { Plans } from "../../plans/ir.mjs";
import { executeSet } from "../../plans/execute.mjs";
import { compileCondition, compileNP } from "../../compiler/ast-to-plan.mjs";
import { ConceptKind } from "../../ids/interners.mjs";
import { isUniversalNounPhrase, resolveEntityId, resolvePredId, resolveUnaryId } from "./helpers.mjs";
import { formatBinaryFact, formatUnaryFact } from "./facts.mjs";
import { renderDerivation } from "./derivation.mjs";
import { buildWitnessTraceForSet } from "./witness-traces.mjs";

function factIdForAssertion(assertion, state, store) {
  if (!assertion || !store) return null;
  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const unaryId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
    if (subjectId === null || unaryId === null) return null;
    return store.makeUnaryFactId(unaryId, subjectId);
  }
  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    const predId = resolvePredId(assertion, state);
    if (subjectId === null || objectId === null || predId === null) return null;
    return store.makeFactId(predId, subjectId, objectId);
  }
  return null;
}

function formatAssertionSentence(assertion, state) {
  if (!assertion) return null;
  if (assertion.kind === "CopulaPredicateAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const unaryId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
    if (subjectId === null || unaryId === null) return null;
    return formatUnaryFact(unaryId, subjectId, state);
  }
  if (assertion.kind === "ActiveRelationAssertion" || assertion.kind === "PassiveRelationAssertion") {
    const subjectId = resolveEntityId(assertion.subject, state);
    const objectId = resolveEntityId(assertion.object, state);
    const predId = resolvePredId(assertion, state);
    if (subjectId === null || objectId === null || predId === null) return null;
    return formatBinaryFact(predId, subjectId, objectId, state);
  }
  return null;
}

export function buildProofTraceForVerify(command, state, ok) {
  const proposition = command?.proposition;
  const store = state.justificationStore;
  const answerSummary = String(ok);

  if (proposition?.kind === "CaseScope" && proposition.mode === "negative") {
    const operand = proposition.operand;
    if (operand?.kind === "AtomicCondition") {
      const sentence = formatAssertionSentence(operand.assertion, state) || "atomic claim";
      if (ok) {
        return {
          kind: "ProofTrace",
          mode: "Negation",
          conclusion: `not (${sentence})`,
          answerSummary,
          steps: [`No derivation found for: ${sentence}`, `Therefore: not (${sentence}).`],
          premises: [],
        };
      }
      if (store) {
        const factId = factIdForAssertion(operand.assertion, state, store);
        if (factId !== null) {
          const { steps, premises } = renderDerivation(factId, state, store);
          return {
            kind: "ProofTrace",
            mode: "Negation",
            conclusion: `not (${sentence})`,
            answerSummary,
            steps: ["Negated claim is false because the inner claim is derivable.", ...steps],
            premises,
          };
        }
      }
      return {
        kind: "ProofTrace",
        mode: "Negation",
        conclusion: `not (${sentence})`,
        answerSummary,
        steps: ["Negated claim is false because the inner claim holds."],
        premises: [],
      };
    }
    return {
      kind: "ProofTrace",
      mode: "Negation",
      conclusion: "negated proposition",
      answerSummary,
      steps: [ok ? "Negated condition holds." : "Negated condition does not hold."],
      premises: [],
    };
  }

  if (proposition?.kind === "AtomicCondition") {
    const assertion = proposition.assertion;
    const isUniversal = assertion?.subject?.kind === "NounPhrase" && isUniversalNounPhrase(assertion.subject);
    if (isUniversal) {
      const basePlan = compileNP(assertion.subject, state);
      const satisfyPlan = compileCondition(proposition, Plans.allEntities(), state);
      const baseSet = executeSet(basePlan, state.kb.kb);
      const satisfySet = executeSet(satisfyPlan, state.kb.kb);
      const diff = baseSet.andNot(satisfySet);
      const domainSize = baseSet.popcount();
      let counterexampleId = null;
      diff.iterateSetBits((entityId) => {
        if (counterexampleId === null) counterexampleId = entityId;
      });
      const steps = [];
      if (ok) {
        steps.push(`Domain size: ${domainSize}.`);
        steps.push("No counterexample found in the quantified domain.");
      } else {
        steps.push(`Domain size: ${domainSize}.`);
        steps.push("Found a counterexample in the quantified domain.");
      }
      const proof = {
        kind: "ProofTrace",
        mode: "Universal",
        conclusion: "universal claim",
        answerSummary,
        steps,
      };
      if (!ok && Number.isInteger(counterexampleId)) {
        const conceptId = state.idStore.getConceptualId(ConceptKind.Entity, counterexampleId);
        const key = conceptId ? state.idStore.lookupKey(conceptId) : null;
        const fallback = `Entity_${counterexampleId}`;
        const entity = key?.startsWith("E:") ? key.slice(2) : key || fallback;
        proof.counterexample = { entity };

        // Best-effort witness: show why the counterexample is in the domain, and what is missing.
        const witness = buildWitnessTraceForSet(basePlan, [{ id: counterexampleId, key }], state, { limit: 1 });
        if (witness?.steps?.length) {
          proof.steps.push("Witness (domain membership):");
          witness.steps
            .filter((line) => !String(line).startsWith("Returned "))
            .slice(0, 40)
            .forEach((line) => proof.steps.push(`  ${String(line)}`));
        }
        if (assertion.kind === "CopulaPredicateAssertion") {
          const unaryId = resolveUnaryId(assertion.complement, state, { negated: assertion.negated });
          if (unaryId !== null) {
            const missing = formatUnaryFact(unaryId, counterexampleId, state);
            proof.steps.push(`Missing: no derivation for ${missing}`);
          }
        }
        if (witness?.premises?.length) {
          proof.premises = (proof.premises ?? []).concat(witness.premises);
        }
      }
      return proof;
    }

    const sentence = formatAssertionSentence(assertion, state);
    if (ok && store) {
      const factId = factIdForAssertion(assertion, state, store);
      if (factId !== null) {
        const { steps, premises } = renderDerivation(factId, state, store);
        return {
          kind: "ProofTrace",
          mode: "Derivation",
          conclusion: sentence || "atomic claim",
          answerSummary,
          steps,
          premises,
        };
      }
    }

    return {
      kind: "ProofTrace",
      mode: "Derivation",
      conclusion: sentence || "atomic claim",
      answerSummary,
      steps: [ok ? "Condition holds." : "Condition is not derivable from the current knowledge base."],
    };
  }

  return {
    kind: "ProofTrace",
    mode: "Derivation",
    conclusion: "proposition",
    answerSummary,
    steps: [ok ? "Condition holds." : "Condition does not hold."],
  };
}
