import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";

test("parse solve command with multiple variables", () => {
  const ast = parseProgram("Solve for ?X and ?Y such that ?X manages ?Y.");
  const command = ast.items[0]?.command;
  assert.equal(command.kind, "SolveCommand");
  assert.equal(command.variables.length, 2);
  assert.equal(command.variables[0].name, "X");
  assert.equal(command.variables[1].name, "Y");
});

test("parse case-scope positive wrapper", () => {
  const ast = parseProgram("Verify that it is the case that John is active.");
  const proposition = ast.items[0]?.command?.proposition;
  assert.equal(proposition.kind, "CaseScope");
  assert.equal(proposition.mode, "positive");
});

test("parse sum aggregation in optimize command", () => {
  const ast = parseProgram(
    "Maximize the sum of weight of all packages such that every package is delivered."
  );
  const command = ast.items[0]?.command;
  assert.equal(command.kind, "MaximizeCommand");
  assert.equal(command.objective.kind, "AggregationExpr");
  assert.equal(command.objective.agg, "SumOf");
});

test("parse action block with multiple preconditions and effects", () => {
  const ast = parseProgram(`Action: Move Package_9
Agent: Robot_4
Precondition: Package_9 is ready.
Precondition: Robot_4 is available.
Effect: Package_9 is delivered.
  Effect: Robot_4 is idle.`);
  const block = ast.items[0];  assert.equal(block.kind, "ActionBlock");
  assert.equal(block.preconditions.length, 2);
  assert.equal(block.effects.length, 2);
});
