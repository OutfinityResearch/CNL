import { test } from "node:test";
import assert from "node:assert/strict";
import { CNLSession } from "../../src/session/cnl-session.mjs";

test("transactional learn rejects explicit unary contradictions", () => {
  const session = new CNLSession({ validateDictionary: false, autoloadBase: false });
  const res = session.learnText(["Alice is active.", "Alice is not active."].join("\n"), { transactional: true });
  assert.equal(res.applied, false);
  assert.ok(res.errors.length > 0);
  assert.ok(String(res.errors[0].message).toLowerCase().includes("contradiction"));
});

test("transactional learn rejects explicit binary contradictions (active relation)", () => {
  const session = new CNLSession({ validateDictionary: false, autoloadBase: false });
  const res = session.learnText(["Alice manages Server_A.", "Alice does not manage Server_A."].join("\n"), { transactional: true });
  assert.equal(res.applied, false);
  assert.ok(res.errors.length > 0);
  assert.ok(String(res.errors[0].message).toLowerCase().includes("contradiction"));
});

