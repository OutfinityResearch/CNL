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
  const ontologyId = String(options.ontologyId || "").trim().toLowerCase();
  const prefixRaw = options.prefix ?? "";
  const prefixToken = String(prefixRaw).trim() ? normalizeTypeKey(prefixRaw) : "";
  const withPrefix = (token) => (prefixToken ? `${prefixToken}-${token}` : token);

  const numericIdKeyRe = /^(bfo|ro|obi|cob|chebi|iao)-\d+$/i;
  const hashKeyRe = /^term-[a-f0-9]{8,}$/i;

  function isOpaqueKey(key) {
    const k = String(key || "").trim();
    return hashKeyRe.test(k) || numericIdKeyRe.test(k);
  }

  const globalPredicateRenames = {
    "w3c-prov-o": {
      entity: "prov-entity",
      agent: "prov-agent",
    },
    foaf: {
      image: "foaf-image",
      "given-name": "foaf-given-name",
      "family-name": "foaf-family-name",
    },
  };

  const className = (iri) => withPrefix(normalizeTypeKey(schema.labels.get(iri) || iri));

  function predInfo(iri) {
    const label = schema.labels.get(iri) || iri;
    const info = normalizePredicatePhrase(label, { prepositions: PREPOSITIONS, keywords: KEYWORDS });

    const renameMap = globalPredicateRenames[ontologyId] || null;
    if (renameMap && renameMap[info.phrase]) {
      const token = renameMap[info.phrase];
      return { phrase: token, style: "active", verbToken: token, particles: [] };
    }

    // Minimal vocabulary harmonization to avoid collisions with common unary concepts.
    // Example: `wgs84:location` should not introduce a binary predicate named `location`,
    // because users naturally write `X is a location` as a unary concept.
    if (ontologyId === "wgs84" && info.phrase === "location") {
      return { phrase: "located in", style: "passive", verbToken: "located", particles: ["in"] };
    }

    if (prefixToken) {
      const token = withPrefix(info.phrase.replace(/\s+/g, "-"));
      return { phrase: token, style: "active", verbToken: token, particles: [] };
    }

    const phrase = info.phrase;
    if (info.style === "passive" && info.particles.length === 1) {
      return { phrase, style: "passive", verbToken: info.verbToken, particles: info.particles };
    }
    if (info.particles.length > 0) {
      return { phrase, style: "active", verbToken: info.verbToken, particles: info.particles };
    }
    return { phrase, style: "active", verbToken: info.verbToken, particles: [] };
  }

  const typeKeys = new Map();
  const droppedOpaqueTypes = [];
  for (const iri of schema.classes) {
    const key = className(iri);
    const score = schema.labelScores?.get(iri) ?? 0;
    if (score <= 0 && isOpaqueKey(key)) {
      droppedOpaqueTypes.push({ iri, key });
      continue;
    }
    typeKeys.set(iri, key);
  }

  const propKeys = new Map();
  const propInfos = new Map();
  const droppedOpaquePredicates = [];
  for (const iri of schema.properties) {
    const info = predInfo(iri);
    const key = info.phrase;
    const score = schema.labelScores?.get(iri) ?? 0;
    const tokenKey = key.replace(/\s+/g, "-");
    if (score <= 0 && isOpaqueKey(tokenKey)) {
      droppedOpaquePredicates.push({ iri, key: tokenKey });
      continue;
    }
    propInfos.set(iri, info);
    propKeys.set(iri, key);
  }

  // Resolve key-level collisions between types (classes) and binary predicates.
  // If a CNL key is used by both a class and a property, we must choose one side to keep the dictionary unambiguous.
  // Strategy (DS24): prefer the property side if there are property-like signals; otherwise prefer the class side.
  const classesByKey = new Map(); // key -> Set(iri)
  for (const iri of schema.classes) {
    const key = typeKeys.get(iri);
    if (!key) continue;
    if (!classesByKey.has(key)) classesByKey.set(key, new Set());
    classesByKey.get(key).add(iri);
  }
  const propsByKey = new Map(); // key -> Set(iri)
  for (const iri of schema.properties) {
    const key = propKeys.get(iri);
    if (!key) continue;
    if (!propsByKey.has(key)) propsByKey.set(key, new Set());
    propsByKey.get(key).add(iri);
  }

  function hasPropertySignals(propIri) {
    return (
      schema.domain?.has(propIri) ||
      schema.range?.has(propIri) ||
      schema.subPropertyOf?.has(propIri) ||
      schema.inverseOf?.has(propIri) ||
      schema.transitive?.has(propIri) ||
      schema.symmetric?.has(propIri) ||
      schema.equivalentProperty?.has(propIri)
    );
  }

  const droppedClassKeys = new Set();
  const droppedPropKeys = new Set();
  const keyCollisions = [];

  for (const [key, classIris] of classesByKey.entries()) {
    const propIris = propsByKey.get(key);
    if (!propIris || propIris.size === 0) continue;

    const preferProperty = [...propIris].some((iri) => hasPropertySignals(iri));
    if (preferProperty) {
      droppedClassKeys.add(key);
      keyCollisions.push({ key, chosen: "property", classes: [...classIris], properties: [...propIris] });
    } else {
      droppedPropKeys.add(key);
      keyCollisions.push({ key, chosen: "class", classes: [...classIris], properties: [...propIris] });
    }
  }

  const dictionaryLines = [];
  const ruleLines = [];

  function pushUniqueLine(lines, seen, line) {
    const key = statementKey(line);
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(line);
  }

  dictionaryLines.push("--- CONTEXT: BaseDictionary ---");
  dictionaryLines.push("");
  dictionaryLines.push(`// Generated from ontology import: ${context}`);

  if (keyCollisions.length > 0) {
    dictionaryLines.push("");
    dictionaryLines.push("// Resolved key collisions (type vs binary predicate):");
    keyCollisions
      .slice()
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .forEach((c) => {
        dictionaryLines.push(`// - "${c.key}": chose ${c.chosen} (dropped ${c.chosen === "property" ? "class" : "property"})`);
      });
  }

  if (Array.isArray(schema.conflicts) && schema.conflicts.length > 0) {
    dictionaryLines.push("");
    dictionaryLines.push("// Resolved class/property conflicts:");
    schema.conflicts
      .slice()
      .sort((a, b) => String(a.iri).localeCompare(String(b.iri)))
      .forEach((c) => {
        const label = schema.labels.get(c.iri) || c.iri;
        dictionaryLines.push(`// - ${label}: chosen ${c.chosen} (${c.reason})`);
      });
  }

  // Types and unary predicates
  const emittedTypeKeys = new Set();
  for (const iri of [...schema.classes].sort()) {
    const key = typeKeys.get(iri);
    if (droppedClassKeys.has(key)) continue;
    if (!key || emittedTypeKeys.has(key)) continue;
    emittedTypeKeys.add(key);
    dictionaryLines.push(`${quote(key)} is a type.`);
    dictionaryLines.push(`${quote(key)} is a "unary predicate".`);
  }

  dictionaryLines.push("");
  dictionaryLines.push("// Binary predicates");
  const emittedPredicateKeys = new Set();
  for (const iri of [...schema.properties].sort()) {
    const key = propKeys.get(iri);
    if (droppedPropKeys.has(key)) continue;
    if (!key || emittedPredicateKeys.has(key)) continue;
    emittedPredicateKeys.add(key);
    dictionaryLines.push(`${quote(key)} is a "binary predicate".`);
  }

  // Type hierarchy
  const ABSTRACT_TYPE_KEYS = new Set([
    "class",
    "type",
    "restriction",
    "property",
    "object-property",
    "datatype-property",
  ]);

  function isAbstractTypeKey(key) {
    return ABSTRACT_TYPE_KEYS.has(String(key || "").toLowerCase());
  }

  const subtypeEdgeSet = new Set(); // `${child}\0${parent}`
  const droppedSubtypeEdges = {
    reflexive: [],
    abstractToConcrete: [],
    cyclic: [],
  };

  function considerSubtypeEdge(childKey, parentKey) {
    if (!childKey || !parentKey) return;
    if (droppedClassKeys.has(childKey) || droppedClassKeys.has(parentKey)) return;

    if (childKey === parentKey) {
      droppedSubtypeEdges.reflexive.push([childKey, parentKey]);
      return;
    }

    if (isAbstractTypeKey(childKey) && !isAbstractTypeKey(parentKey)) {
      droppedSubtypeEdges.abstractToConcrete.push([childKey, parentKey]);
      return;
    }

    subtypeEdgeSet.add(`${childKey}\0${parentKey}`);
  }

  for (const [child, parents] of schema.subClassOf.entries()) {
    const childKey = typeKeys.get(child);
    for (const parent of parents) {
      const parentKey = typeKeys.get(parent);
      considerSubtypeEdge(childKey, parentKey);
    }
  }
  for (const [a, bs] of schema.equivalentClass.entries()) {
    const aKey = typeKeys.get(a);
    for (const b of bs) {
      const bKey = typeKeys.get(b);
      considerSubtypeEdge(aKey, bKey);
    }
  }

  const subtypeEdges = [...subtypeEdgeSet]
    .map((key) => {
      const [childKey, parentKey] = key.split("\0");
      return { childKey, parentKey };
    })
    .sort((a, b) => {
      const childCmp = a.childKey.localeCompare(b.childKey);
      if (childCmp !== 0) return childCmp;
      return a.parentKey.localeCompare(b.parentKey);
    });

  function wouldCreateCycle(childKey, parentKey, graph) {
    if (childKey === parentKey) return true;
    const seen = new Set();
    const stack = [parentKey];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === childKey) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      const parents = graph.get(current);
      if (!parents) continue;
      for (const p of parents) stack.push(p);
    }
    return false;
  }

  const acceptedSubtypeEdges = [];
  const subtypeGraph = new Map(); // childKey -> Set(parentKey)

  for (const edge of subtypeEdges) {
    if (wouldCreateCycle(edge.childKey, edge.parentKey, subtypeGraph)) {
      droppedSubtypeEdges.cyclic.push([edge.childKey, edge.parentKey]);
      continue;
    }
    if (!subtypeGraph.has(edge.childKey)) subtypeGraph.set(edge.childKey, new Set());
    subtypeGraph.get(edge.childKey).add(edge.parentKey);
    acceptedSubtypeEdges.push(edge);
  }

  if (acceptedSubtypeEdges.length > 0) {
    dictionaryLines.push("");
    dictionaryLines.push("// Type hierarchy");

    const dropCounts = [
      ["reflexive", droppedSubtypeEdges.reflexive],
      ["abstract-to-concrete", droppedSubtypeEdges.abstractToConcrete],
      ["cycle-break", droppedSubtypeEdges.cyclic],
    ].filter(([, edges]) => edges.length > 0);

    if (dropCounts.length > 0) {
      dictionaryLines.push("// Dropped subtype edges:");
      for (const [label, edges] of dropCounts) {
        const samples = edges
          .slice(0, 5)
          .map(([c, p]) => `"${c}" -> "${p}"`)
          .join(", ");
        dictionaryLines.push(`// - ${label}: ${edges.length}${samples ? ` (e.g. ${samples})` : ""}`);
      }
    }

    acceptedSubtypeEdges
      .map((e) => `${quote(e.childKey)} is a subtype of ${quote(e.parentKey)}.`)
      .sort()
      .forEach((l) => dictionaryLines.push(l));
  }

  // Domain and range
  const domainRangeLines = [];
  const domainRangeSeen = new Set();
  for (const [prop, domains] of schema.domain.entries()) {
    const propKey = propKeys.get(prop);
    if (droppedPropKeys.has(propKey)) continue;
    for (const d of domains) {
      const dKey = typeKeys.get(d);
      if (droppedClassKeys.has(dKey)) continue;
      if (!propKey || !dKey) continue;
      pushUniqueLine(domainRangeLines, domainRangeSeen, `the domain of ${quote(propKey)} is ${quote(dKey)}.`);
    }
  }
  for (const [prop, ranges] of schema.range.entries()) {
    const propKey = propKeys.get(prop);
    if (droppedPropKeys.has(propKey)) continue;
    for (const r of ranges) {
      const rKey = typeKeys.get(r);
      if (droppedClassKeys.has(rKey)) continue;
      if (!propKey || !rKey) continue;
      pushUniqueLine(domainRangeLines, domainRangeSeen, `the range of ${quote(propKey)} is ${quote(rKey)}.`);
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

  function renderBinaryFactTemplate(propIri, sName = "?X", oName = "?Y") {
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
  const subpropSeen = new Set();
  for (const [child, parents] of schema.subPropertyOf.entries()) {
      const childKey = propKeys.get(child);
      if (droppedPropKeys.has(childKey)) continue;
      for (const parent of parents) {
        const parentKey = propKeys.get(parent);
        if (droppedPropKeys.has(parentKey)) continue;
      const a = renderBinaryFactTemplate(child, "?X", "?Y");
      const b = renderBinaryFactTemplate(parent, "?X", "?Y");
      if (!a || !b) continue;
      pushUniqueLine(subpropRules, subpropSeen, `Rule: If ${a}, then ${b}.`);
    }
  }
  for (const [a, bs] of schema.equivalentProperty.entries()) {
    const aKey = propKeys.get(a);
    if (droppedPropKeys.has(aKey)) continue;
    for (const bIri of bs) {
      const bKey = propKeys.get(bIri);
      if (droppedPropKeys.has(bKey)) continue;
      const aFact = renderBinaryFactTemplate(a, "?X", "?Y");
      const bFact = renderBinaryFactTemplate(bIri, "?X", "?Y");
      if (!aFact || !bFact) continue;
      pushUniqueLine(subpropRules, subpropSeen, `Rule: If ${aFact}, then ${bFact}.`);
    }
  }

  // Inverse rules
  const inverseRules = [];
  const inverseSeen = new Set();
  for (const [p, qs] of schema.inverseOf.entries()) {
    const pKey = propKeys.get(p);
    if (droppedPropKeys.has(pKey)) continue;
    for (const q of qs) {
      const qKey = propKeys.get(q);
      if (droppedPropKeys.has(qKey)) continue;
      const a = renderBinaryFactTemplate(p, "?X", "?Y");
      const b = renderBinaryFactTemplate(q, "?Y", "?X");
      if (!a || !b) continue;
      pushUniqueLine(inverseRules, inverseSeen, `Rule: If ${a}, then ${b}.`);
    }
  }

  // Symmetric rules
  const symmetricRules = [];
  const symmetricSeen = new Set();
  for (const p of schema.symmetric) {
    const pKey = propKeys.get(p);
    if (droppedPropKeys.has(pKey)) continue;
    const a = renderBinaryFactTemplate(p, "?X", "?Y");
    const b = renderBinaryFactTemplate(p, "?Y", "?X");
    if (!a || !b) continue;
    pushUniqueLine(symmetricRules, symmetricSeen, `Rule: If ${a}, then ${b}.`);
  }

  // Transitive rules
  const transitiveRules = [];
  const transitiveSeen = new Set();
  for (const p of schema.transitive) {
    const pKey = propKeys.get(p);
    if (droppedPropKeys.has(pKey)) continue;
    const a = renderBinaryFactTemplate(p, "?X", "?Y");
    const b = renderBinaryFactTemplate(p, "?Y", "?Z");
    const c = renderBinaryFactTemplate(p, "?X", "?Z");
    if (!a || !b || !c) continue;
    pushUniqueLine(transitiveRules, transitiveSeen, `Rule: If ${a} and ${b}, then ${c}.`);
  }

  const allRules = [...subpropRules, ...inverseRules, ...symmetricRules, ...transitiveRules].sort();
  if (allRules.length === 0) {
    ruleLines.push("// (no schema rules generated)");
  } else {
    ruleLines.push(...allRules);
  }

  let unlabeledDictionary = "";
  if (droppedOpaqueTypes.length > 0 || droppedOpaquePredicates.length > 0) {
    const lines = [];
    lines.push("--- CONTEXT: BaseDictionary ---");
    lines.push("");
    lines.push(`// Dropped opaque terms (no label found) while importing: ${context}`);
    lines.push("// Note: this file is for audit only and is not loaded by base bundles.");

    if (droppedOpaqueTypes.length > 0) {
      lines.push("");
      lines.push("// Dropped types:");
      droppedOpaqueTypes
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .forEach(({ iri, key }) => {
          lines.push(`// - "${key}" (IRI: ${iri})`);
          lines.push(`//   "${key}" is a type.`);
          lines.push(`//   "${key}" is a "unary predicate".`);
        });
    }

    if (droppedOpaquePredicates.length > 0) {
      lines.push("");
      lines.push("// Dropped binary predicates:");
      droppedOpaquePredicates
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .forEach(({ iri, key }) => {
          lines.push(`// - "${key}" (IRI: ${iri})`);
          lines.push(`//   "${key}" is a "binary predicate".`);
        });
    }

    unlabeledDictionary = lines.join("\n") + "\n";
  }

  return {
    dictionary: dictionaryLines.join("\n") + "\n",
    rules: ruleLines.join("\n") + "\n",
    unlabeledDictionary,
    generatedStatementKeys: new Set([
      ...dictionaryLines.map(statementKey),
      ...ruleLines.map(statementKey),
    ]),
  };
}
