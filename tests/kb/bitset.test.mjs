import { test } from "node:test";
import assert from "node:assert/strict";
import { createBitset } from "../../src/kb/bitset.mjs";

test("bitset set/clear and logical ops", () => {
  const a = createBitset(8);
  const b = createBitset(8);
  a.setBit(1).setBit(3);
  b.setBit(3).setBit(4);

  assert.ok(a.hasBit(1));
  assert.ok(!a.hasBit(2));

  const and = a.and(b);
  assert.ok(and.hasBit(3));
  assert.ok(!and.hasBit(1));

  const or = a.or(b);
  assert.ok(or.hasBit(1));
  assert.ok(or.hasBit(4));

  const diff = a.andNot(b);
  assert.ok(diff.hasBit(1));
  assert.ok(!diff.hasBit(3));
});

test("bitset resize enables higher indices", () => {
  const bits = createBitset(1);
  bits.resize(3);
  bits.setBit(2);
  assert.ok(bits.hasBit(2));
});

test("bitset throws on out-of-range indices", () => {
  const bits = createBitset(2);
  assert.throws(() => bits.hasBit(2), /Bitset index out of range/);
  assert.throws(() => bits.setBit(-1), /Bitset index out of range/);
  assert.throws(() => bits.clearBit(999), /Bitset index out of range/);
});
