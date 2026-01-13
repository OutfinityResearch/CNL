import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";

test("parser handles multi-word noun phrase cores", () => {
  const tests = [
    { input: 'A "critical server" is online.', expected: ["critical server"] },
    { input: 'The "heavy truck" is loaded.', expected: ["heavy truck"] },
    { input: 'Every "active user" is active.', expected: ["active user"] },
    { input: 'A "red car" is parked.', expected: ["red car"] },
  ];

  for (const { input, expected } of tests) {
    const ast = parseProgram(input);
    const sentence = ast.items[0].sentence;
    const subject = sentence.assertion.subject;

    assert.strictEqual(subject.kind, "NounPhrase", `Input "${input}" should have a NounPhrase subject`);
    assert.deepEqual(subject.core, expected, `Input "${input}" has incorrect core`);
  }
});

test("parser handles simple name subjects", () => {
    const ast = parseProgram("Truck_A is active.");
    const subject = ast.items[0].sentence.assertion.subject;
    assert.strictEqual(subject.kind, "Name");
    assert.strictEqual(subject.value, "Truck_A");
});