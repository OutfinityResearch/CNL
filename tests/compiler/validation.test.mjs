import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { compileProgram } from "../../src/compiler/compile.mjs";

const aritySource = `--- CONTEXT: BaseDictionary ---
"likes" is a unary predicate.
--- CONTEXT: Core ---
Alice likes Bob.`;

test("dictionary arity mismatch triggers an error", () => {
  const ast = parseProgram(aritySource);
  const state = compileProgram(ast);
  assert.ok(state.errors.some((err) => err.code === "CMP015"));
});

const comparatorSource = `--- CONTEXT: BaseDictionary ---
"capacity" is a numeric attribute.
the comparator of "capacity" is "greater than".
--- CONTEXT: Core ---
capacity is less than 10.`;

test("disallowed comparator triggers an error", () => {
  const ast = parseProgram(comparatorSource);
  const state = compileProgram(ast);
  assert.ok(state.errors.some((err) => err.code === "CMP012"));
});

const passivePredicateSource = `--- CONTEXT: BaseDictionary ---
"assigned to" is a unary predicate.
--- CONTEXT: Core ---
Task_1 is assigned to Agent_1.`;

test("dictionary arity mismatch applies to passive predicates", () => {
  const ast = parseProgram(passivePredicateSource);
  const state = compileProgram(ast);
  assert.ok(state.errors.some((err) => err.code === "CMP015"));
});

const particlePredicateSource = `--- CONTEXT: BaseDictionary ---
"logs in" is a binary predicate.
--- CONTEXT: Core ---
User_1 logs in System_1.`;

test("dictionary predicate keys with particles normalize correctly", () => {
  const ast = parseProgram(particlePredicateSource);
  const state = compileProgram(ast);
  assert.equal(state.errors.length, 0);
});
