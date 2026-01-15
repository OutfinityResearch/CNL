import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";

test("conditions: mixed and/or without grouping is rejected (SYN011)", () => {
  assert.throws(
    () => parseProgram("Verify that John is active or John is suspended and John is a user."),
    (err) => err && err.code === "SYN011",
  );
});

test("conditions: parentheses allow mixing and/or via explicit grouping", () => {
  const ast = parseProgram("Verify that (John is active or John is suspended) and John is a user.");
  const cmd = ast.items[0].command;
  assert.equal(cmd.kind, "VerifyCommand");
  assert.equal(cmd.proposition.kind, "AndChain");
  assert.equal(cmd.proposition.items[0].kind, "GroupCondition");
  assert.equal(cmd.proposition.items[1].kind, "AtomicCondition");
});

test("conditions: comparator 'or' is not treated as boolean operator", () => {
  const ast = parseProgram("Verify that the score is greater than or equal to 10.");
  const cmd = ast.items[0].command;
  assert.equal(cmd.kind, "VerifyCommand");
  assert.equal(cmd.proposition.kind, "AtomicCondition");
  assert.equal(cmd.proposition.assertion.kind, "ComparisonAssertion");
  assert.equal(cmd.proposition.assertion.comparator.kind, "Comparator");
  assert.equal(cmd.proposition.assertion.comparator.op, "GreaterThanOrEqualTo");
});
