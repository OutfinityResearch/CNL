import { createKB } from "../../kb/kb.mjs";
import { createNumericIndex } from "../../kb/numeric-index.mjs";
import { createEntityAttrIndex } from "../../kb/entity-attrs.mjs";
import { bitsetFactoryFor, emptySet } from "./helpers.mjs";

function cloneBitset(bitset, kbState) {
  if (!bitset) return emptySet(kbState);
  if (typeof bitset.clone === "function") return bitset.clone();
  const clone = bitsetFactoryFor(kbState)(bitset.size ?? kbState.entitiesCount);
  if (typeof bitset.iterateSetBits === "function") {
    bitset.iterateSetBits((idx) => clone.setBit(idx));
  }
  return clone;
}

function cloneNumericIndex(index, kbState) {
  if (!index) return null;
  const clone = createNumericIndex(index.values.length, bitsetFactoryFor(kbState));
  clone.values.set(index.values);
  index.hasValue.iterateSetBits((idx) => clone.hasValue.setBit(idx));
  return clone;
}

function cloneEntityAttrIndex(index, kbState) {
  if (!index) return null;
  const clone = createEntityAttrIndex(index.values.length, bitsetFactoryFor(kbState));
  for (let i = 0; i < index.values.length; i += 1) {
    clone.values[i] = cloneBitset(index.values[i], kbState);
  }
  return clone;
}

export function cloneKbApi(kbApi) {
  const base = kbApi.kb;
  const cloned = createKB({ bitsetFactory: base.bitsetFactory });
  const target = cloned.kb;

  target.entitiesCount = base.entitiesCount;
  target.predicatesCount = base.predicatesCount;
  target.unaryCount = base.unaryCount;
  target.attributesCount = base.attributesCount;

  target.relations = base.relations.map((matrix) => ({
    rows: matrix.rows.map((row) => cloneBitset(row, base)),
  }));
  target.invRelations = base.invRelations.map((matrix) => ({
    rows: matrix.rows.map((row) => cloneBitset(row, base)),
  }));
  target.unaryIndex = base.unaryIndex.map((bitset) => cloneBitset(bitset, base));
  target.numericIndex = base.numericIndex.map((index) => cloneNumericIndex(index, base));
  target.entAttrIndex = base.entAttrIndex.map((index) => cloneEntityAttrIndex(index, base));

  return cloned;
}
