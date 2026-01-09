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
});
