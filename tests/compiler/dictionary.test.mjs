import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProgram } from "../../src/parser/grammar.mjs";
import { createDictionaryState, applyDictionaryStatement } from "../../src/compiler/dictionary.mjs";

const source = `--- CONTEXT: BaseDictionary ---
"likes" is a "binary predicate".
the domain of "likes" is "Person".
the range of "likes" is "Pizza".
"capacity" is a "numeric attribute".
"capacity" is a "functional attribute".
the comparator of "capacity" is "greater than".
"Person" is a type.
"Driver" is a subtype of "Person".`;

test("dictionary declarations compile into dictionary state", () => {
  const ast = parseProgram(source);
  const state = createDictionaryState();
  for (const item of ast.items) {
    if (item.kind === "Statement") {
      applyDictionaryStatement(item, state);
    }
  }

  const likes = state.predicates.get("like");
  assert.ok(likes);
  assert.equal(likes.arity, "binary");
  assert.deepEqual(likes.domain, ["Person"]);
  assert.deepEqual(likes.range, ["Pizza"]);

  const capacity = state.attributes.get("capacity");
  assert.ok(capacity);
  assert.equal(capacity.valueType, "numeric");
  assert.equal(capacity.functional, true);
  assert.ok(capacity.comparators.has("greater than"));

  const driver = state.types.get("Driver");
  assert.ok(driver);
  assert.equal(driver.parent, "Person");
});
