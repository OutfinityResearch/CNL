import { test } from "node:test";
import assert from "node:assert/strict";
import { CNLSession } from "../../src/session/cnl-session.mjs";

test("session query executes return command against learned facts", () => {
  const session = new CNLSession();
  const learn = session.learnText(`--- CONTEXT: BaseDictionary ---
"role" is an "entity attribute".
--- CONTEXT: Core ---
User1 is a user.
User1 has a role of Admin.`);
  assert.equal(learn.errors.length, 0);

  const result = session.query("Return the name of every user whose role is equal to Admin.");
  assert.equal(result.kind, "QueryResult");
  assert.deepEqual(result.entities.map((entry) => entry.key), ["E:User1"]);
});

test("session proof evaluates verify commands", () => {
  const session = new CNLSession();
  const learn = session.learnText("Server1 handles Payments.");
  assert.equal(learn.errors.length, 0);

  const result = session.proof("Verify that Server1 handles Payments.");
  assert.equal(result.kind, "ProofResult");
  assert.equal(result.value, true);
});

test("session explain returns base justification for ground unary facts", () => {
  const session = new CNLSession();
  const learn = session.learnText("Server1 is a server.");
  assert.equal(learn.errors.length, 0);

  const result = session.explain("Explain why Server1 is a server.");
  assert.equal(result.kind, "ExplainResult");
  assert.equal(result.justification.kind, "Base");
});

test("session solve returns filtered entities", () => {
  const session = new CNLSession();
  const learn = session.learnText(`--- CONTEXT: BaseDictionary ---
"capacity" is a "numeric attribute".
--- CONTEXT: Core ---
Truck_A is a truck.
Truck_B is a truck.
Truck_A has a capacity of 900.
Truck_B has a capacity of 100.`);
  assert.equal(learn.errors.length, 0);

  const result = session.solve("Solve for every truck whose capacity is greater than 500.");
  assert.equal(result.kind, "SolveResult");
  assert.deepEqual(result.entities.map((entry) => entry.key), ["E:Truck_A"]);
});
