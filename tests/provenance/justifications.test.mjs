import { test } from "node:test";
import assert from "node:assert/strict";
import { createJustificationStore } from "../../src/provenance/justifications.mjs";

test("FactID uses 128-bit u32 packing (binary)", () => {
  const store = createJustificationStore();
  const factId = store.makeFactId(4000000000, 70000, 90000);
  const decoded = store.unpackFactId(factId);
  assert.deepEqual(decoded, { type: "binary", predId: 4000000000, subjectId: 70000, objectId: 90000 });
});

test("FactID uses 128-bit u32 packing (unary)", () => {
  const store = createJustificationStore();
  const factId = store.makeUnaryFactId(1234567890, 90000);
  const decoded = store.unpackFactId(factId);
  assert.deepEqual(decoded, { type: "unary", unaryId: 1234567890, subjectId: 90000 });
});

test("FactID packing throws on negative ids", () => {
  const store = createJustificationStore();
  assert.throws(() => store.makeFactId(-1, 0, 0), /out of range/i);
  assert.throws(() => store.makeUnaryFactId(-1, 0), /out of range/i);
});

