import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";

test("parser handles 'is not' negation with unary predicates", () => {
  const tests = [
    { input: "X is not valid.", negated: true, complement: "valid" },
    { input: "X is valid.", negated: false, complement: "valid" },
    { input: "the contract is not binding.", negated: true, complement: "binding" },
    { input: "Server1 is not active.", negated: true, complement: "active" },
  ];

  for (const { input, negated, complement } of tests) {
    const ast = parseProgram(input);
    const assertion = ast.items[0].sentence.assertion;

    assert.strictEqual(assertion.kind, "CopulaPredicateAssertion", `Input "${input}" should be CopulaPredicateAssertion`);
    assert.strictEqual(assertion.negated, negated, `Input "${input}" should have negated=${negated}`);
    assert.strictEqual(assertion.complement.value, complement, `Input "${input}" should have complement="${complement}"`);
  }
});

test("parser handles 'is not' negation with type assertions", () => {
  const tests = [
    { input: "X is not a person.", negated: true, core: ["person"] },
    { input: "X is a person.", negated: false, core: ["person"] },
    { input: "the entity is not an organization.", negated: true, core: ["organization"] },
  ];

  for (const { input, negated, core } of tests) {
    const ast = parseProgram(input);
    const assertion = ast.items[0].sentence.assertion;

    assert.strictEqual(assertion.kind, "CopulaPredicateAssertion", `Input "${input}" should be CopulaPredicateAssertion`);
    assert.strictEqual(assertion.negated, negated, `Input "${input}" should have negated=${negated}`);
    assert.strictEqual(assertion.complement.kind, "NounPhrase", `Input "${input}" should have NounPhrase complement`);
    assert.deepEqual(assertion.complement.core, core, `Input "${input}" should have core=${JSON.stringify(core)}`);
  }
});

test("parser handles 'is not' negation with passive relations", () => {
  const tests = [
    { input: "Y is not prohibited by X.", negated: true, verb: "prohibited", prep: "by" },
    { input: "Y is prohibited by X.", negated: false, verb: "prohibited", prep: "by" },
    { input: "the document is not signed by the user.", negated: true, verb: "signed", prep: "by" },
    { input: "the file is not located in the folder.", negated: true, verb: "located", prep: "in" },
  ];

  for (const { input, negated, verb, prep } of tests) {
    const ast = parseProgram(input);
    const assertion = ast.items[0].sentence.assertion;

    assert.strictEqual(assertion.kind, "PassiveRelationAssertion", `Input "${input}" should be PassiveRelationAssertion`);
    assert.strictEqual(assertion.negated, negated, `Input "${input}" should have negated=${negated}`);
    assert.strictEqual(assertion.verb, verb, `Input "${input}" should have verb="${verb}"`);
    assert.strictEqual(assertion.preposition, prep, `Input "${input}" should have preposition="${prep}"`);
  }
});

test("parser handles negation in rule consequents", () => {
  const tests = [
    {
      input: "Rule: If X permits Y, then Y is not prohibited by X.",
      negated: true,
      kind: "PassiveRelationAssertion",
    },
    {
      input: "Rule: If X repeals Y and X is active, then Y is not valid.",
      negated: true,
      kind: "CopulaPredicateAssertion",
    },
    {
      input: "Rule: If X is a human, then X is not a machine.",
      negated: true,
      kind: "CopulaPredicateAssertion",
    },
  ];

  for (const { input, negated, kind } of tests) {
    const ast = parseProgram(input);
    const rule = ast.items[0].sentence;

    assert.strictEqual(rule.kind, "ConditionalSentence", `Input "${input}" should be ConditionalSentence`);
    // In ConditionalSentence, the 'then' property holds the consequent sentence
    const consequentAssertion = rule.then.assertion;
    assert.strictEqual(consequentAssertion.kind, kind, `Input "${input}" consequent should be ${kind}`);
    assert.strictEqual(consequentAssertion.negated, negated, `Input "${input}" consequent should have negated=${negated}`);
  }
});

test("parser handles negation in rule antecedents", () => {
  const input = "Rule: If X is not valid, then X is rejected.";
  const ast = parseProgram(input);
  const rule = ast.items[0].sentence;

  assert.strictEqual(rule.kind, "ConditionalSentence");
  assert.strictEqual(rule.condition.assertion.kind, "CopulaPredicateAssertion");
  assert.strictEqual(rule.condition.assertion.negated, true);
  assert.strictEqual(rule.condition.assertion.complement.value, "valid");
});

test("parser handles 'it is not the case that' negation", () => {
  const input = "Rule: If it is not the case that X is valid, then X is rejected.";
  const ast = parseProgram(input);
  const rule = ast.items[0].sentence;

  assert.strictEqual(rule.kind, "ConditionalSentence");
  assert.strictEqual(rule.condition.kind, "CaseScope");
  assert.strictEqual(rule.condition.mode, "negative");
});

test("parser handles all copula forms with negation", () => {
  const copulas = ["is", "are", "was", "were"];

  for (const copula of copulas) {
    const input = `X ${copula} not valid.`;
    const ast = parseProgram(input);
    const assertion = ast.items[0].sentence.assertion;

    assert.strictEqual(assertion.kind, "CopulaPredicateAssertion", `Copula "${copula}" should work`);
    assert.strictEqual(assertion.negated, true, `Copula "${copula}" should have negated=true`);
    assert.strictEqual(assertion.copula, copula, `Copula should be "${copula}"`);
  }
});

test("parser handles negation in relative clauses with copula predicates", () => {
  const tests = [
    { input: "every contract that is not signed is pending.", negated: true, complement: "signed" },
    { input: "the user who is not verified is rejected.", negated: true, complement: "verified" },
    { input: "a person who is authorized is allowed.", negated: false, complement: "authorized" },
  ];

  for (const { input, negated, complement } of tests) {
    const ast = parseProgram(input);
    const subject = ast.items[0].sentence.assertion.subject;

    assert.strictEqual(subject.kind, "NounPhrase", `Input "${input}" should have NounPhrase subject`);
    assert.ok(subject.relative, `Input "${input}" should have relative clause`);

    const body = subject.relative.body;
    assert.strictEqual(body.kind, "RelCopulaPredicate", `Input "${input}" should have RelCopulaPredicate body`);
    assert.strictEqual(body.negated, negated, `Input "${input}" should have negated=${negated}`);
    assert.strictEqual(body.complement.value, complement, `Input "${input}" should have complement="${complement}"`);
  }
});

test("parser handles negation in relative clauses with passive relations", () => {
  const tests = [
    { input: "every document that is not approved by the manager is pending.", negated: true, verb: "approved" },
    { input: "the file that is located in the folder is accessible.", negated: false, verb: "located" },
  ];

  for (const { input, negated, verb } of tests) {
    const ast = parseProgram(input);
    const subject = ast.items[0].sentence.assertion.subject;

    assert.strictEqual(subject.kind, "NounPhrase", `Input "${input}" should have NounPhrase subject`);
    assert.ok(subject.relative, `Input "${input}" should have relative clause`);

    const body = subject.relative.body;
    assert.strictEqual(body.kind, "RelPassiveRelation", `Input "${input}" should have RelPassiveRelation body`);
    assert.strictEqual(body.negated, negated, `Input "${input}" should have negated=${negated}`);
    assert.strictEqual(body.verb, verb, `Input "${input}" should have verb="${verb}"`);
  }
});

test("parser handles complex negation scenarios", () => {
  const tests = [
    "Rule: If X is a law and X repeals Y, then Y is not in-effect.",
    "Rule: If X is not authorized by Y, then X is not valid.",
    "every contract that is not signed by the parties is not binding.",
    "the user who is not verified is not allowed.",
    "a person who is not authorized is rejected.",
  ];

  for (const input of tests) {
    try {
      parseProgram(input);
      assert.ok(true, `Input "${input}" should parse successfully`);
    } catch (e) {
      assert.fail(`Input "${input}" failed to parse: ${e.message}`);
    }
  }
});
