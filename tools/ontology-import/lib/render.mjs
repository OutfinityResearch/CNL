import { PREPOSITIONS, KEYWORDS } from "../../../src/parser/grammar/constants.mjs";
import { normalizePredicatePhrase, normalizeTypeKey } from "./iris.mjs";

function normalizeStatementLine(line) {
  return String(line || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

function quote(text) {
  return `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function statementKey(line) {
  return normalizeStatementLine(line);
}

export function renderOntologyCnl(schema, options = {}) {
  const context = options.context || "ImportedOntology";
  const className = (iri) => normalizeTypeKey(schema.labels.get(iri) || iri);

  function predInfo(iri) {
    const label = schema.labels.get(iri) || iri;
    return normalizePredicatePhrase(label, { prepositions: PREPOSITIONS, keywords: KEYWORDS });
  }

  const typeKeys = new Map();
  for (const iri of schema.classes) {
    typeKeys.set(iri, className(iri));
  }

  const propKeys = new Map();
  const propInfos = new Map();
  for (const iri of schema.properties) {
    const info = predInfo(iri);
    propInfos.set(iri, info);
    propKeys.set(iri, info.phrase);
  }

  const dictionaryLines = [];
  const ruleLines = [];

  dictionaryLines.push("--- CONTEXT: BaseDictionary ---");
  dictionaryLines.push("");
  dictionaryLines.push(`// Generated from ontology import: ${context}`);

  // Types and unary predicates
  for (const iri of [...schema.classes].sort()) {
    const key = typeKeys.get(iri);
    dictionaryLines.push(`${quote(key)} is a type.`);
    dictionaryLines.push(`${quote(key)} is a "unary predicate".`);
  }

  dictionaryLines.push("");
  dictionaryLines.push("// Binary predicates");
  for (const iri of [...schema.properties].sort()) {
    const key = propKeys.get(iri);
    dictionaryLines.push(`${quote(key)} is a "binary predicate".`);
  }

  // Type hierarchy
  const subtypeLines = [];
  for (const [child, parents] of schema.subClassOf.entries()) {
    const childKey = typeKeys.get(child);
    for (const parent of parents) {
      const parentKey = typeKeys.get(parent);
      if (!childKey || !parentKey) continue;
      subtypeLines.push(`${quote(childKey)} is a subtype of ${quote(parentKey)}.`);
    }
  }
  for (const [a, bs] of schema.equivalentClass.entries()) {
    const aKey = typeKeys.get(a);
    for (const b of bs) {
      const bKey = typeKeys.get(b);
      if (!aKey || !bKey) continue;
      subtypeLines.push(`${quote(aKey)} is a subtype of ${quote(bKey)}.`);
    }
  }
  if (subtypeLines.length > 0) {
    dictionaryLines.push("");
    dictionaryLines.push("// Type hierarchy");
    subtypeLines.sort().forEach((l) => dictionaryLines.push(l));
  }

  // Domain and range
  const domainRangeLines = [];
  for (const [prop, domains] of schema.domain.entries()) {
    const propKey = propKeys.get(prop);
    for (const d of domains) {
      const dKey = typeKeys.get(d);
      if (!propKey || !dKey) continue;
      domainRangeLines.push(`the domain of ${quote(propKey)} is ${quote(dKey)}.`);
    }
  }
  for (const [prop, ranges] of schema.range.entries()) {
    const propKey = propKeys.get(prop);
    for (const r of ranges) {
      const rKey = typeKeys.get(r);
      if (!propKey || !rKey) continue;
      domainRangeLines.push(`the range of ${quote(propKey)} is ${quote(rKey)}.`);
    }
  }
  if (domainRangeLines.length > 0) {
    dictionaryLines.push("");
    dictionaryLines.push("// Domain and range constraints");
    domainRangeLines.sort().forEach((l) => dictionaryLines.push(l));
  }

  // Rules context
  ruleLines.push(`--- CONTEXT: ${context} ---`);
  ruleLines.push("");
  ruleLines.push(`// Generated from ontology import: ${context}`);

  function renderBinaryFactTemplate(propIri, sName = "X", oName = "Y") {
    const info = propInfos.get(propIri);
    const phrase = propKeys.get(propIri);
    if (!info || !phrase) return null;
    if (info.style === "passive" && info.particles.length === 1) {
      return `${sName} is ${info.verbToken} ${info.particles[0]} ${oName}`;
    }
    if (info.particles.length > 0) {
      return `${sName} ${info.verbToken} ${info.particles.join(" ")} ${oName}`;
    }
    return `${sName} ${info.verbToken} ${oName}`;
  }

  // Subproperty rules (copy)
  const subpropRules = [];
  for (const [child, parents] of schema.subPropertyOf.entries()) {
    for (const parent of parents) {
      const a = renderBinaryFactTemplate(child, "X", "Y");
      const b = renderBinaryFactTemplate(parent, "X", "Y");
      if (!a || !b) continue;
      subpropRules.push(`Rule: If ${a}, then ${b}.`);
    }
  }
  for (const [a, bs] of schema.equivalentProperty.entries()) {
    for (const bIri of bs) {
      const aFact = renderBinaryFactTemplate(a, "X", "Y");
      const bFact = renderBinaryFactTemplate(bIri, "X", "Y");
      if (!aFact || !bFact) continue;
      subpropRules.push(`Rule: If ${aFact}, then ${bFact}.`);
    }
  }

  // Inverse rules
  const inverseRules = [];
  for (const [p, qs] of schema.inverseOf.entries()) {
    for (const q of qs) {
      const a = renderBinaryFactTemplate(p, "X", "Y");
      const b = renderBinaryFactTemplate(q, "Y", "X");
      if (!a || !b) continue;
      inverseRules.push(`Rule: If ${a}, then ${b}.`);
    }
  }

  // Symmetric rules
  const symmetricRules = [];
  for (const p of schema.symmetric) {
    const a = renderBinaryFactTemplate(p, "X", "Y");
    const b = renderBinaryFactTemplate(p, "Y", "X");
    if (!a || !b) continue;
    symmetricRules.push(`Rule: If ${a}, then ${b}.`);
  }

  // Transitive rules
  const transitiveRules = [];
  for (const p of schema.transitive) {
    const a = renderBinaryFactTemplate(p, "X", "Y");
    const b = renderBinaryFactTemplate(p, "Y", "Z");
    const c = renderBinaryFactTemplate(p, "X", "Z");
    if (!a || !b || !c) continue;
    transitiveRules.push(`Rule: If ${a} and ${b}, then ${c}.`);
  }

  const allRules = [...subpropRules, ...inverseRules, ...symmetricRules, ...transitiveRules].sort();
  if (allRules.length === 0) {
    ruleLines.push("// (no schema rules generated)");
  } else {
    ruleLines.push(...allRules);
  }

  return {
    dictionary: dictionaryLines.join("\n") + "\n",
    rules: ruleLines.join("\n") + "\n",
    generatedStatementKeys: new Set([
      ...dictionaryLines.map(statementKey),
      ...ruleLines.map(statementKey),
    ]),
  };
}
