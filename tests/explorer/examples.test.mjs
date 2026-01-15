import test from "node:test";
import assert from "node:assert/strict";
import { CNLSession } from "../../src/session/cnl-session.mjs";
import { ConceptKind } from "../../src/ids/interners.mjs";
import { DEMO_SUITE } from "../../evals/kbDemo/suite.mjs";

function isActionLabelLine(line) {
  return /^(action|agent|precondition|effect)\s*:/i.test(line.trim());
}

function splitTheorySteps(theory) {
  const lines = String(theory || "").replace(/\r\n/g, "\n").split("\n");
  const steps = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (isActionLabelLine(trimmed)) {
      const block = [];
      while (i < lines.length && lines[i].trim() && isActionLabelLine(lines[i].trim())) {
        block.push(lines[i].trim());
        i += 1;
      }
      steps.push(block.join("\n"));
      continue;
    }
    steps.push(trimmed);
    i += 1;
  }
  return steps;
}

function lookupKey(idStore, kind, denseId) {
  const cid = idStore.getConceptualId(kind, denseId);
  if (cid === undefined) return `[${denseId}]`;
  return idStore.lookupKey(cid) || `[${denseId}]`;
}

function formatEntityKey(key, fallbackId) {
  if (!key) return `#${fallbackId}`;
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function formatCategoryKey(key) {
  if (!key) return "(unknown)";
  return key.startsWith("U:") ? key.slice(2) : key;
}

function formatPredicateKey(key) {
  if (!key) return "(unknown)";
  const clean = key.startsWith("P:") ? key.slice(2) : key;
  return clean.split("|").join(" ");
}

function factToSentence(fact, session) {
  const idStore = session.state.idStore;
  if (!fact || !idStore) return null;
  if (fact.type === "unary") {
    const subjectKey = lookupKey(idStore, ConceptKind.Entity, fact.subjectId);
    const unaryKey = lookupKey(idStore, ConceptKind.UnaryPredicate, fact.unaryId);
    return `${formatEntityKey(subjectKey, fact.subjectId)} is a ${formatCategoryKey(unaryKey)}`;
  }
  if (fact.type === "binary") {
    const subjectKey = lookupKey(idStore, ConceptKind.Entity, fact.subjectId);
    const objectKey = lookupKey(idStore, ConceptKind.Entity, fact.objectId);
    const predKey = lookupKey(idStore, ConceptKind.Predicate, fact.predId);
    return `${formatEntityKey(subjectKey, fact.subjectId)} ${formatPredicateKey(predKey)} ${formatEntityKey(objectKey, fact.objectId)}`;
  }
  return null;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

function collectEntityNames(entities = []) {
  return entities.map((entry) => formatEntityKey(entry.key, entry.id));
}

function assertLearnResult(result, context) {
  if (!result) {
    assert.fail(`${context}: no result`);
  }
  if (result.error) {
    assert.fail(`${context}: ${result.error.message || result.error}`);
  }
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const first = result.errors[0];
    assert.fail(`${context}: ${first.message || first}`);
  }
}

function assertCommandResult(step, result, session) {
  if (!result) assert.fail(`${step.command}: no result`);
  if (result.error) {
    assert.fail(`${step.command}: ${result.error.message || result.error}`);
  }

  if (step.expectedMatches) {
    assert.equal(result.kind, "ExplainResult", `${step.command}: expected ExplainResult`);
    const store = session.state.justificationStore;
    assert.ok(store, `${step.command}: missing justification store`);
    const justification = result.justification || {};
    const premiseIds = justification.premiseIds || [];
    const premiseSentences = premiseIds
      .map((id) => factToSentence(store.unpackFactId(id), session))
      .filter(Boolean)
      .map(normalizeText);
    step.expectedMatches.forEach((expected) => {
      const needle = normalizeText(expected);
      const found = premiseSentences.some((text) => text.includes(needle));
      assert.ok(found, `${step.command}: missing premise '${expected}'`);
    });
    return;
  }

  const expected = step.expected;
  if (expected === undefined || expected === null) return;

  if (expected === "true" || expected === "false" || expected === "unknown") {
    assert.equal(result.kind, "ProofResult", `${step.command}: expected ProofResult`);
    assert.equal(String(result.value), expected, `${step.command}: unexpected proof result`);
    return;
  }

  if (expected.startsWith("[") && expected.endsWith("]")) {
    assert.ok(
      result.kind === "QueryResult" || result.kind === "SolveResult",
      `${step.command}: expected QueryResult or SolveResult`
    );
    const names = collectEntityNames(result.entities);
    const expectedNames = JSON.parse(expected);
    assert.deepEqual(names, expectedNames, `${step.command}: unexpected query result`);
    return;
  }

  if (expected.startsWith("steps=")) {
    assert.equal(result.kind, "SimulationResult", `${step.command}: expected SimulationResult`);
    const expectedSteps = Number(expected.split("=")[1]);
    assert.equal(result.steps, expectedSteps, `${step.command}: unexpected step count`);
    return;
  }

  if (expected === "satisfied" || expected === "unsatisfied") {
    assert.equal(result.kind, "PlanResult", `${step.command}: expected PlanResult`);
    assert.equal(result.status, expected, `${step.command}: unexpected plan status`);
    return;
  }

  if (result.kind === "SolveResult" || result.kind === "QueryResult") {
    const names = collectEntityNames(result.entities);
    assert.equal(names.length, 1, `${step.command}: expected single entity`);
    assert.equal(names[0], expected, `${step.command}: unexpected entity result`);
    return;
  }

  assert.fail(`${step.command}: unhandled expected format '${expected}'`);
}

test("Explorer examples execute without errors", () => {
  DEMO_SUITE.forEach((example) => {
    const session = new CNLSession();
    const steps = splitTheorySteps(example.theory);
    steps.forEach((statement, idx) => {
      const result = session.execute(statement);
      assertLearnResult(result, `${example.id} statement ${idx + 1}`);
    });

    example.steps.forEach((step) => {
      const result = session.execute(step.command);
      assertCommandResult(step, result, session);
    });
  });
});
