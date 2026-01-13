import test from "node:test";
import assert from "node:assert/strict";

import { parseProgram } from "../../src/parser/grammar.mjs";
import {
  HasFormDeterminismError,
  MissingTerminatorError,
  MixedBooleanOperatorsError,
} from "../../src/validator/errors.mjs";

test("exports provide named error helpers", () => {
  assert.equal(HasFormDeterminismError("x").code, "SYN008");
  assert.equal(MissingTerminatorError("EOF").code, "SYN003");
  assert.equal(MixedBooleanOperatorsError("or").code, "SYN011");
});

test("SYN003 MissingTerminatorError", () => {
  assert.throws(
    () => parseProgram("John likes pizza"),
    (err) => err?.code === "SYN003" && err?.primaryToken === "EOF"
  );
});

test("SYN008 HasFormDeterminismError", () => {
  assert.throws(
    () => parseProgram("Truck_A has capacity of 1000."),
    (err) => err?.code === "SYN008" && err?.primaryToken === "capacity"
  );
});

test("SYN011 MixedBooleanOperatorsError", () => {
  assert.throws(
    () => parseProgram("Verify that John likes pizza or Mary likes sushi and Bob likes tacos."),
    (err) => err?.code === "SYN011" && ["or", "and"].includes(err?.primaryToken)
  );
});

test("SYN010 RelativePronounRepetitionError", () => {
  assert.throws(
    () => parseProgram("A user who is active and knows Python is privileged."),
    (err) => err?.code === "SYN010" && err?.primaryToken === "knows"
  );
});

test("SYN013 ActionBlockMissingRequiredFieldError", () => {
  assert.throws(
    () =>
      parseProgram(`
Action: Deliver package.
Effect: Package_1 is delivered.
`),
    (err) => err?.code === "SYN013" && err?.offendingField === "Agent"
  );
});
