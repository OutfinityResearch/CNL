import { test } from "node:test";
import assert from "node:assert/strict";
import { createKB } from "../../src/kb/kb.mjs";
import { executeSet } from "../../src/plans/execute.mjs";
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
