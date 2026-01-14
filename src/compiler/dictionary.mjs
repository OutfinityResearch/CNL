function createError(code, message, primaryToken) {
  return {
    code,
    name: "DictionaryError",
    message,
    severity: "error",
    primaryToken: primaryToken ?? "EOF",
    hint: "Check BaseDictionary declaration syntax.",
  };
}

export function createDictionaryState() {
  return {
    predicates: new Map(),
    attributes: new Map(),
    types: new Map(),
    errors: [],
    warnings: [],
    _statementCounts: new Map(),
    _issueKeys: new Set(),
  };
}

function noteStatement(state, key, message) {
  if (!state || !state._statementCounts) return;
  const k = String(key || "").trim();
  if (!k) return;
  const next = (state._statementCounts.get(k) ?? 0) + 1;
  state._statementCounts.set(k, next);
  // Duplicate dictionary statements are treated as idempotent and are silently deduplicated.
  // Theory-level duplicate reporting is handled by tooling (see tools/check-theories.mjs).
}

function noteIssueOnce(state, issueKey, issue) {
  if (!state || !state._issueKeys) return;
  const k = String(issueKey || "").trim();
  if (!k) return;
  if (state._issueKeys.has(k)) return;
  state._issueKeys.add(k);
  state.warnings.push(issue);
}

function getOrCreatePredicate(state, key) {
  if (!state.predicates.has(key)) {
    state.predicates.set(key, { key, arity: null, arities: new Set(), domain: [], range: [] });
  }
  return state.predicates.get(key);
}

function getOrCreateAttribute(state, key) {
  if (!state.attributes.has(key)) {
    state.attributes.set(key, {
      key,
      valueType: null,
      functional: null,
      comparators: new Set(),
      domain: [],
    });
  }
  return state.attributes.get(key);
}

function getOrCreateType(state, key) {
  if (!state.types.has(key)) {
    state.types.set(key, { key, parent: null, parents: new Set() });
  }
  return state.types.get(key);
}

function extractStringLiteral(node) {
  if (node && node.kind === "StringLiteral") {
    return node.value;
  }
  return null;
}

function coreHas(core, word) {
  return core.includes(word);
}

function normalizeCore(node) {
  if (!node || node.kind !== "NounPhrase") return [];
  return node.core.flatMap((item) => item.toLowerCase().split(/\s+/).filter(Boolean));
}

function normalizeBinaryPredicateKey(key) {
  if (!key) return key;
  let normalized = key.trim();
  if (normalized.startsWith("passive:")) {
    normalized = normalized.slice("passive:".length);
  }
  if (!normalized.includes("|")) {
    normalized = normalized.split(/\s+/).join("|");
  }
  return normalized;
}

function extractOfObject(np) {
  if (!np || np.kind !== "NounPhrase") return null;
  const found = np.pp.find((pp) => pp.preposition === "of");
  return found ? found.object : null;
}

function handlePredicateDeclaration(subjectKey, complement, state) {
  const core = normalizeCore(complement);
  if (!coreHas(core, "predicate")) return false;

  const isBinary = coreHas(core, "binary");
  const isUnary = coreHas(core, "unary");
  const normalizedKey = isBinary ? normalizeBinaryPredicateKey(subjectKey) : subjectKey.trim();
  const def = getOrCreatePredicate(state, normalizedKey);
  if (isBinary) def.arities.add("binary");
  if (isUnary) def.arities.add("unary");
  if (def.arities.size === 1) {
    def.arity = def.arities.has("binary") ? "binary" : "unary";
  } else if (def.arities.size > 1) {
    def.arity = null;
    state.warnings.push({
      kind: "AmbiguousPredicateArity",
      severity: "warning",
      message: `Predicate '${normalizedKey}' declared as both unary and binary.`,
      key: normalizedKey,
    });
  }
  if (!def.arity && def.arities.size === 0) {
    state.errors.push(createError("DICT010", "Predicate arity is required.", subjectKey));
  }
  noteStatement(state, `pred:${normalizedKey}:${[...def.arities].sort().join(",")}`, `Predicate declared: ${normalizedKey}`);

  // Conflict taxonomy: if the same key is both a type and a binary predicate, treat it as a hard issue.
  // (Type + unary predicate is an intentional synonym pair used by imported ontologies.)
  if (def.arities.has("binary")) {
    const candidates = new Set([subjectKey.trim(), normalizedKey.trim()]);
    for (const cand of candidates) {
      if (!cand) continue;
      if (state.types.has(cand)) {
        noteIssueOnce(state, `conflict:type-binary:${cand}`, {
          kind: "TypeBinaryPredicateConflict",
          severity: "error",
          message: `Dictionary key '${cand}' is declared both as a type and as a binary predicate.`,
          key: cand,
        });
        break;
      }
    }
  }
  return true;
}

function handleAttributeDeclaration(subjectKey, complement, state) {
  const core = normalizeCore(complement);
  if (!coreHas(core, "attribute")) return false;

  const def = getOrCreateAttribute(state, subjectKey);
  if (coreHas(core, "numeric")) def.valueType = "numeric";
  if (coreHas(core, "entity")) def.valueType = "entity";
  if (coreHas(core, "functional")) def.functional = true;
  if (coreHas(core, "multivalued") || (coreHas(core, "multi") && coreHas(core, "valued"))) {
    def.functional = false;
  }
  noteStatement(state, `attr:${subjectKey}:${def.valueType ?? "unknown"}`, `Attribute declared: ${subjectKey}`);
  return true;
}

function handleTypeDeclaration(subjectKey, complement, state) {
  const core = normalizeCore(complement);
  if (!coreHas(core, "type") && !coreHas(core, "subtype")) return false;

  const def = getOrCreateType(state, subjectKey);
  if (coreHas(core, "subtype")) {
    const parentNode = extractOfObject(complement);
    const parentKey = extractStringLiteral(parentNode);
    if (!parentKey) {
      state.errors.push(createError("DICT020", "Subtype declaration missing parent.", subjectKey));
      return true;
    }
    def.parents.add(parentKey);
    if (def.parents.size === 1) {
      def.parent = parentKey;
    } else {
      def.parent = null;
      state.warnings.push({
        kind: "AmbiguousTypeParent",
        severity: "warning",
        message: `Type '${subjectKey}' declared with multiple parents: ${[...def.parents].sort().join(", ")}.`,
        key: subjectKey,
      });
    }
  }
  noteStatement(state, `type:${subjectKey}:${def.parent ?? "none"}`, `Type declared: ${subjectKey}`);
  return true;
}

function handleDomainRange(subject, complement, state) {
  if (!subject || subject.kind !== "NounPhrase") return false;
  const core = normalizeCore(subject);
  const isDomain = coreHas(core, "domain");
  const isRange = coreHas(core, "range");
  if (!isDomain && !isRange) return false;

  const predicateNode = extractOfObject(subject);
  let predicateKey = extractStringLiteral(predicateNode);
  if (!predicateKey) {
    state.errors.push(createError("DICT030", "Domain/range declaration missing predicate key.", "domain"));
    return true;
  }
  predicateKey = normalizeBinaryPredicateKey(predicateKey);

  const typeKey = extractStringLiteral(complement);
  if (!typeKey) {
    state.errors.push(createError("DICT031", "Domain/range declaration missing type key.", predicateKey));
    return true;
  }

  const def = getOrCreatePredicate(state, predicateKey);
  if (isDomain) def.domain.push(typeKey);
  if (isRange) def.range.push(typeKey);
  noteStatement(state, `${isDomain ? "domain" : "range"}:${predicateKey}:${typeKey}`, `${isDomain ? "Domain" : "Range"} declared: ${predicateKey} -> ${typeKey}`);
  return true;
}

function handleComparator(subject, complement, state) {
  if (!subject || subject.kind !== "NounPhrase") return false;
  const core = normalizeCore(subject);
  if (!coreHas(core, "comparator")) return false;

  const attrNode = extractOfObject(subject);
  const attrKey = extractStringLiteral(attrNode);
  if (!attrKey) {
    state.errors.push(createError("DICT040", "Comparator declaration missing attribute key.", "comparator"));
    return true;
  }

  const comparatorText = extractStringLiteral(complement);
  if (!comparatorText) {
    state.errors.push(createError("DICT041", "Comparator declaration missing comparator literal.", attrKey));
    return true;
  }

  const def = getOrCreateAttribute(state, attrKey);
  def.comparators.add(comparatorText.toLowerCase());
  noteStatement(state, `cmp:${attrKey}:${comparatorText.toLowerCase()}`, `Comparator declared: ${attrKey} -> ${comparatorText}`);
  return true;
}

function handleCopulaDeclaration(assertion, state) {
  const subjectKey = extractStringLiteral(assertion.subject);
  if (!subjectKey) {
    state.errors.push(createError("DICT001", "Dictionary key must be a string literal.", "subject"));
    return;
  }

  if (assertion.complement.kind !== "NounPhrase") {
    state.errors.push(createError("DICT002", "Dictionary complement must be a noun phrase.", "complement"));
    return;
  }

  const handled =
    handlePredicateDeclaration(subjectKey, assertion.complement, state) ||
    handleAttributeDeclaration(subjectKey, assertion.complement, state) ||
    handleTypeDeclaration(subjectKey, assertion.complement, state);

  if (!handled) {
    state.errors.push(createError("DICT003", "Unsupported dictionary declaration.", subjectKey));
  }
}

function applyDictionaryAssertion(assertion, state) {
  if (!assertion || assertion.kind !== "CopulaPredicateAssertion") {
    state.errors.push(createError("DICT000", "Dictionary statements must use copula forms.", "assertion"));
    return;
  }

  if (handleDomainRange(assertion.subject, assertion.complement, state)) return;
  if (handleComparator(assertion.subject, assertion.complement, state)) return;

  handleCopulaDeclaration(assertion, state);
}

export function applyDictionaryStatement(node, state) {
  if (!node) return;
  if (node.kind !== "Statement") {
    state.errors.push(createError("DICT000", "Dictionary requires statements.", node.kind));
    return;
  }
  const sentence = node.sentence;
  if (!sentence || sentence.kind !== "AssertionSentence") {
    state.errors.push(createError("DICT000", "Dictionary statements must be assertions.", node.kind));
    return;
  }
  applyDictionaryAssertion(sentence.assertion, state);
}
