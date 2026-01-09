import { test } from "node:test";
import assert from "node:assert/strict";
import { createKB } from "../../src/kb/kb.mjs";
import { executeSet, executeNumber } from "../../src/plans/execute.mjs";
import { Plans } from "../../src/plans/ir.mjs";

test("executeSet preimage returns subjects", () => {
  const kbApi = createKB();
  kbApi.insertBinary(0, 0, 1);
  kbApi.insertBinary(2, 0, 1);

  const set = executeSet(Plans.preimage(0, Plans.entitySet(1)), kbApi.kb);
  assert.ok(set.hasBit(0));
  assert.ok(set.hasBit(2));
  assert.ok(!set.hasBit(1));
});

test("executeNumber aggregates numeric attributes", () => {
  const kbApi = createKB();
  kbApi.setNumeric(0, 0, 5);
  kbApi.setNumeric(0, 1, 15);
  const set = Plans.union([Plans.entitySet(0), Plans.entitySet(1)]);

  const numberOf = executeNumber(Plans.aggregate("NumberOf", set), kbApi.kb);
  const sumOf = executeNumber(Plans.aggregate("SumOf", set, 0), kbApi.kb);
  const avgOf = executeNumber(Plans.aggregate("AverageOf", set, 0), kbApi.kb);
  const totalOf = executeNumber(Plans.aggregate("TotalOf", set, 0), kbApi.kb);

  assert.equal(numberOf, 2);
  assert.equal(sumOf, 20);
  assert.equal(avgOf, 10);
  assert.equal(totalOf, 20);
});
