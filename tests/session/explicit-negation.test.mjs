import { test } from "node:test";
import assert from "node:assert/strict";
import { CNLSession } from "../../src/session/cnl-session.mjs";

test("explicit unary negation is learnable and provable", () => {
  const session = new CNLSession({ validateDictionary: false });
  const learn = session.learnText("Alice is not active.");
  assert.equal(learn.errors.length, 0);

  const neg = session.proof("Verify that Alice is not active.");
  assert.equal(neg.kind, "ProofResult");
  assert.equal(neg.value, true);

  const pos = session.proof("Verify that Alice is active.");
  assert.equal(pos.kind, "ProofResult");
  assert.equal(pos.value, false);
});

test("explicit unary negation can be derived by rules", () => {
  const session = new CNLSession({ validateDictionary: false });
  const learn = session.learnText([
    "Bob is a user.",
    "Bob is suspended.",
    "Rule: Every user that is suspended is not active.",
  ].join("\n"));
  assert.equal(learn.errors.length, 0);

  const neg = session.proof("Verify that Bob is not active.");
  assert.equal(neg.kind, "ProofResult");
  assert.equal(neg.value, true);
});

test("explicit passive relation negation is learnable and provable", () => {
  const session = new CNLSession({ validateDictionary: false });
  const learn = session.learnText("Document_1 is not signed by User_1.");
  assert.equal(learn.errors.length, 0);

  const neg = session.proof("Verify that Document_1 is not signed by User_1.");
  assert.equal(neg.kind, "ProofResult");
  assert.equal(neg.value, true);

  const pos = session.proof("Verify that Document_1 is signed by User_1.");
  assert.equal(pos.kind, "ProofResult");
  assert.equal(pos.value, false);
});

test("explicit active relation negation is learnable and provable", () => {
  const session = new CNLSession({ validateDictionary: false });
  const learn = session.learnText("Alice does not manage Server_A.");
  assert.equal(learn.errors.length, 0);

  const neg = session.proof("Verify that Alice does not manage Server_A.");
  assert.equal(neg.kind, "ProofResult");
  assert.equal(neg.value, true);

  const pos = session.proof("Verify that Alice manages Server_A.");
  assert.equal(pos.kind, "ProofResult");
  assert.equal(pos.value, false);
});
