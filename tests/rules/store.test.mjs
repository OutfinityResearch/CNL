import { test } from "node:test";
import assert from "node:assert/strict";
import { createKB } from "../../src/kb/kb.mjs";
import { createRuleStore } from "../../src/rules/store.mjs";
import { Plans } from "../../src/plans/ir.mjs";

const kbApi = createKB();
const { kb } = kbApi;

// Entity IDs: 0=Server1, 1=Payments
kbApi.insertUnary(0, 0);
kbApi.insertBinary(0, 0, 1);

const ruleStore = createRuleStore();
const body = Plans.preimage(0, Plans.entitySet(1));
const head = { kind: "UnaryEmit", unaryId: 1 };
ruleStore.addRule({ kind: "RulePlan", body, head });

test("rule store applies unary head from body set", () => {
  const added = ruleStore.applyRules(kbApi);
  assert.equal(added, 1);
  assert.ok(kb.unaryIndex[1].hasBit(0));
});
