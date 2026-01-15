import { ConceptKind } from "../../ids/interners.mjs";

function displayEntityKey(key) {
  if (!key) return "";
  if (key.startsWith("E:lit:num:")) return key.slice("E:lit:num:".length);
  if (key.startsWith("E:lit:str:")) return key.slice("E:lit:str:".length);
  if (key.startsWith("E:lit:bool:")) return key.slice("E:lit:bool:".length);
  if (key.startsWith("E:")) return key.slice(2);
  if (key.startsWith("L:")) return key.slice(2);
  return key;
}

function displayUnaryKey(key) {
  if (!key) return "";
  if (key.startsWith("U:not|")) return `not ${key.slice("U:not|".length)}`;
  if (key.startsWith("U:")) return key.slice(2);
  return key;
}

function displayPredKey(key) {
  if (!key) return "";
  let verb = key.startsWith("P:") ? key.slice(2) : key;
  let negated = false;
  if (verb.startsWith("not|")) {
    negated = true;
    verb = verb.slice("not|".length);
  }
  let passive = false;
  if (verb.startsWith("passive:")) {
    passive = true;
    verb = verb.slice("passive:".length);
  }
  const phrase = verb.split("|").join(" ");
  if (passive && negated) return `is not ${phrase}`;
  if (passive) return `is ${phrase}`;
  return negated ? `not ${phrase}` : phrase;
}

function displayAttrKey(key) {
  if (!key) return "";
  if (key.startsWith("A:")) return key.slice(2);
  return key;
}

function lookupKey(state, kind, denseId) {
  const conceptId = state.idStore.getConceptualId(kind, denseId);
  return conceptId ? state.idStore.lookupKey(conceptId) : null;
}

export function formatUnaryFact(unaryId, subjectId, state) {
  const subjectKey = lookupKey(state, ConceptKind.Entity, subjectId);
  const unaryKey = lookupKey(state, ConceptKind.UnaryPredicate, unaryId);
  if (!subjectKey || !unaryKey) return null;
  const subject = displayEntityKey(subjectKey);
  const predicate = displayUnaryKey(unaryKey);
  if (predicate.startsWith("not ")) {
    return `${subject} is ${predicate}.`;
  }
  return `${subject} is a ${predicate}.`;
}

export function formatBinaryFact(predId, subjectId, objectId, state) {
  const subjectKey = lookupKey(state, ConceptKind.Entity, subjectId);
  const objectKey = lookupKey(state, ConceptKind.Entity, objectId);
  const predKey = lookupKey(state, ConceptKind.Predicate, predId);
  if (!subjectKey || !objectKey || !predKey) return null;
  const subject = displayEntityKey(subjectKey);
  const object = displayEntityKey(objectKey);
  const phrase = displayPredKey(predKey);
  if (phrase.startsWith("is ")) {
    return `${subject} ${phrase} ${object}.`;
  }
  return `${subject} ${phrase} ${object}.`;
}

export function formatNumericAttrFact(attrId, subjectId, value, state) {
  const subjectKey = lookupKey(state, ConceptKind.Entity, subjectId);
  const attrKey = lookupKey(state, ConceptKind.Attribute, attrId);
  if (!subjectKey || !attrKey) return null;
  const subject = displayEntityKey(subjectKey);
  const attr = displayAttrKey(attrKey);
  return `${subject} has a ${attr} of ${value}.`;
}

export function formatEntityAttrFact(attrId, subjectId, entityId, state) {
  const subjectKey = lookupKey(state, ConceptKind.Entity, subjectId);
  const attrKey = lookupKey(state, ConceptKind.Attribute, attrId);
  const entityKey = lookupKey(state, ConceptKind.Entity, entityId);
  if (!subjectKey || !attrKey || !entityKey) return null;
  const subject = displayEntityKey(subjectKey);
  const attr = displayAttrKey(attrKey);
  const value = displayEntityKey(entityKey);
  return `${subject} has a ${attr} of ${value}.`;
}

export function formatFactId(factId, state, store) {
  const decoded = store.unpackFactId(factId);
  if (!decoded) return null;
  if (decoded.type === "unary") {
    return formatUnaryFact(decoded.unaryId, decoded.subjectId, state);
  }
  if (decoded.type === "binary") {
    return formatBinaryFact(decoded.predId, decoded.subjectId, decoded.objectId, state);
  }
  if (decoded.type === "numeric") {
    return formatNumericAttrFact(decoded.attrId, decoded.subjectId, decoded.value, state);
  }
  if (decoded.type === "entityAttr") {
    return formatEntityAttrFact(decoded.attrId, decoded.subjectId, decoded.entityId, state);
  }
  return null;
}
