import { test } from "node:test";
import assert from "node:assert/strict";
import { createNumericIndex } from "../../src/kb/numeric-index.mjs";
import { createBitset } from "../../src/kb/bitset.mjs";

test("numeric index filters by comparator", () => {
  const index = createNumericIndex(3, createBitset);
  index.setValue(0, 10);
  index.setValue(1, 20);
  index.setValue(2, 5);

  const gt = index.filter("greater than", 9);
  assert.ok(gt.hasBit(0));
  assert.ok(gt.hasBit(1));
  assert.ok(!gt.hasBit(2));

  const gte = index.filter("greater than or equal to", 10);
  assert.ok(gte.hasBit(0));
  assert.ok(gte.hasBit(1));
  assert.ok(!gte.hasBit(2));

  const lt = index.filter("less than", 10);
  assert.ok(!lt.hasBit(0));
  assert.ok(!lt.hasBit(1));
  assert.ok(lt.hasBit(2));

  const lte = index.filter("less than or equal to", 10);
  assert.ok(lte.hasBit(0));
  assert.ok(!lte.hasBit(1));
  assert.ok(lte.hasBit(2));

  const eq = index.filter("equal to", 20);
  assert.ok(!eq.hasBit(0));
  assert.ok(eq.hasBit(1));
  assert.ok(!eq.hasBit(2));

  const neq = index.filter("not equal to", 10);
  assert.ok(!neq.hasBit(0));
  assert.ok(neq.hasBit(1));
  assert.ok(neq.hasBit(2));
});
