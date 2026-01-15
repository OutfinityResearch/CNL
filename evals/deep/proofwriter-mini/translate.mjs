function normalizeSentence(line) {
  let text = String(line || "").trim();
  if (!text) return "";
  if (!text.endsWith(".")) text += ".";
  return text;
}

function stripLeadingIndex(sentence) {
  return String(sentence || "")
    .trim()
    .replace(/^\(?\d+\)?\s*[:.)-]?\s*/i, "")
    .trim();
}

function splitTheoryText(theory) {
  if (Array.isArray(theory)) return theory.map(String);
  if (typeof theory !== "string") return [];
  const normalized = theory.replace(/\r\n/g, "\n").replace(/\n/g, " ").trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitConjunctionPredicates(text) {
  // Example: "big and quiet" -> ["big", "quiet"]
  return String(text || "")
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleCaseWord(word) {
  const w = String(word || "").trim();
  if (!w) return w;
  return w[0].toUpperCase() + w.slice(1);
}

function normalizeEntityPhrase(phrase) {
  const raw = String(phrase || "").trim();
  if (!raw) return "";
  const withoutDet = raw.replace(/^(the|a|an)\s+/i, "").trim();
  const cleaned = withoutDet.replace(/[^A-Za-z0-9 _-]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((p) => titleCaseWord(p)).join("_");
}

function pastParticiple(verb) {
  const v = String(verb || "").trim().toLowerCase();
  if (!v) return v;
  if (v.endsWith("e")) return `${v}d`;
  if (v.endsWith("y") && v.length >= 2 && !/[aeiou]y$/i.test(v)) return `${v.slice(0, -1)}ied`;
  return `${v}ed`;
}

function stripTrailingDot(text) {
  return String(text || "").trim().replace(/\.\s*$/, "").trim();
}

function parseIfThenRuleLine(line) {
  const m = String(line || "")
    .trim()
    .match(/^if\s+(.+?)\s+then\s+(.+?)\.\s*$/i);
  if (!m) return null;
  return { ifPart: m[1].trim(), thenPart: m[2].trim() };
}

function splitOnAndChain(text) {
  return String(text || "")
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeUnaryTailForCopula(tail) {
  // Keep "a/an" typing if present; otherwise normalize as a predicate name.
  const t = String(tail || "").trim();
  if (!t) return null;
  if (/^(a|an)\s+/i.test(t)) return t.toLowerCase().startsWith("an ") ? `an ${t.slice(3).trim()}` : `a ${t.slice(2).trim()}`;
  return normalizePredicateTail(t);
}

function translateSimpleClauseToAtom(clause) {
  const text = stripTrailingDot(String(clause || "").trim());
  if (!text) return null;

  // Unary: "<subj> is (not) <tail>"
  const unary = text.match(/^(?:the\s+)?(.+?)\s+is\s+(not\s+)?(.+?)$/i);
  if (unary) {
    const subject = normalizeEntityPhrase(unary[1]);
    const neg = Boolean(unary[2]);
    const tail = normalizeUnaryTailForCopula(unary[3]);
    if (!subject || !tail) return null;
    return `${subject} is ${neg ? "not " : ""}${tail}`;
  }

  // Binary: "<subj> (does not) <verb> (the) <obj>"
  const binary = text.match(/^(?:the\s+)?(.+?)\s+(does\s+not\s+)?([a-z][a-z0-9_-]*)\s+(?:the\s+)?(.+?)$/i);
  if (binary) {
    const subject = normalizeEntityPhrase(binary[1]);
    const neg = Boolean(binary[2]);
    const verb = String(binary[3] || "").trim().toLowerCase();
    const object = normalizeEntityPhrase(binary[4]);
    if (!subject || !verb || !object) return null;
    if (!neg) return `${subject} ${verb} ${object}`;
    const pp = pastParticiple(verb);
    return `${object} is not ${pp} by ${subject}`;
  }

  return null;
}

function rewriteIfThenRule(line) {
  const parsed = parseIfThenRuleLine(line);
  if (!parsed) return null;

  // Only rewrite if needed (to avoid "does ..." comparator ambiguity and multi-word noun phrases).
  const needsRewrite =
    /\bdoes\s+not\b/i.test(line) ||
    /^if\s+the\s+/i.test(line) ||
    /\bthen\s+the\s+/i.test(line);
  if (!needsRewrite) return null;

  const condClauses = splitOnAndChain(parsed.ifPart);
  const condAtoms = condClauses.map(translateSimpleClauseToAtom);
  if (condAtoms.some((a) => !a)) return null;

  const thenAtom = translateSimpleClauseToAtom(parsed.thenPart);
  if (!thenAtom) return null;

  return `Rule: If ${condAtoms.join(" and ")} then ${thenAtom}.`;
}

function rewriteDeterminerUnaryFact(line) {
  const m = line.match(/^(the|a|an)\s+(.+?)\s+is\s+(not\s+)?(.+?)\.\s*$/i);
  if (!m) return null;
  const subject = normalizeEntityPhrase(m[2]);
  if (!subject) return null;
  const neg = Boolean(m[3]);
  const tail = String(m[4] || "").trim();
  if (!tail) return null;
  return `${subject} is ${neg ? "not " : ""}${tail}.`;
}

function rewriteDeterminerBinaryFact(line) {
  const m = line.match(
    /^(the|a|an)\s+(.+?)\s+(does\s+not\s+)?([a-z][a-z0-9_-]*)\s+(the|a|an)\s+(.+?)\.\s*$/i,
  );
  if (!m) return null;
  const subject = normalizeEntityPhrase(m[2]);
  const object = normalizeEntityPhrase(m[6]);
  const verb = String(m[4] || "").trim().toLowerCase();
  if (!subject || !object || !verb) return null;
  const neg = Boolean(m[3]);
  if (!neg) {
    return `${subject} ${verb} ${object}.`;
  }
  const pp = pastParticiple(verb);
  return `${object} is not ${pp} by ${subject}.`;
}

function rewriteIfThingThenBinaryRule(line) {
  // Example: "If something is blue and kind then it chases the dog."
  const m = line.match(
    /^if\s+(someone|something)\s+is\s+(.+?)\s+then\s+(they|it)\s+([a-z][a-z0-9_-]*)\s+(?:the\s+)?(.+?)\.\s*$/i,
  );
  if (!m) return null;
  const domain = m[1].toLowerCase() === "someone" ? "person" : "thing";
  const condTail = m[2];
  const verb = String(m[4] || "").trim().toLowerCase();
  const object = normalizeEntityPhrase(m[5]);
  if (!verb || !object) return null;

  const predicates = splitConjunctionPredicates(condTail);
  const relative = renderRelativeAnd(predicates);
  if (!relative) return null;
  return `Rule: Every ${domain} ${relative} ${verb} ${object}.`;
}

function lowerFirst(text) {
  const t = String(text || "").trim();
  if (!t) return t;
  return t[0].toLowerCase() + t.slice(1);
}

function normalizePredicateTail(tail) {
  const t = String(tail || "").trim();
  if (!t) return t;
  if (t.toLowerCase().startsWith("not ")) return `not ${t.slice(4).trim()}`;
  if (t.toLowerCase().startsWith("a ")) return `a ${t.slice(2).trim()}`;
  if (t.toLowerCase().startsWith("an ")) return `an ${t.slice(3).trim()}`;
  return lowerFirst(t);
}

function renderCopulaPredicate(tail) {
  const t = normalizePredicateTail(tail);
  if (!t) return null;
  if (t.startsWith("not ")) return `is not ${t.slice(4).trim()}`;
  return `is ${t}`;
}

function renderRelativeClauseForPredicate(tail) {
  const t = normalizePredicateTail(tail);
  if (!t) return null;
  if (t.startsWith("not ")) return `that is not ${t.slice(4).trim()}`;
  return `that is ${t}`;
}

function renderRelativeAnd(predicates) {
  const clauses = [];
  for (const p of predicates || []) {
    const clause = renderRelativeClauseForPredicate(p);
    if (!clause) return null;
    clauses.push(clause);
  }
  return clauses.join(" and ");
}

function rewriteSomeoneRule(line) {
  // Example: "If someone is big and quiet then they are round."
  // Example: "If something is furry and not round then it is not green."
  const m = line.match(
    /^if\s+(someone|something)\s+is\s+(.+?)\s+then\s+(they|it)\s+(?:are|is)\s+(.+?)\.\s*$/i,
  );
  if (!m) return null;

  const domain = m[1].toLowerCase() === "someone" ? "person" : "thing";
  const condTail = m[2];
  const thenTail = m[4];

  const predicates = splitConjunctionPredicates(condTail);
  const relative = renderRelativeAnd(predicates);
  const head = renderCopulaPredicate(thenTail);
  if (!relative || !head) return null;

  return `Rule: Every ${domain} ${relative} ${head}.`;
}

function rewriteEveryRule(line) {
  // Example: "Every tiger is fierce."
  const m = line.match(/^every\s+([a-z][a-z0-9_-]*)\s+is\s+(.+?)\.\s*$/i);
  if (!m) return null;
  const noun = m[1];
  const tail = m[2];
  const head = renderCopulaPredicate(tail);
  if (!head) return null;
  return `Rule: Every ${noun} ${head}.`;
}

function rewriteAllNounRule(line) {
  // Example: "All tigers are fierce."
  const m = line.match(/^all\s+([a-z][a-z0-9_-]*)s?\s+are\s+(.+?)\.\s*$/i);
  if (!m) return null;
  const noun = m[1];
  const tail = m[2];
  const head = renderCopulaPredicate(tail);
  if (!head) return null;
  return `Rule: Every ${noun} ${head}.`;
}

function rewriteAdjectiveNounRule(line) {
  // Example: "Big, rough people are round."
  // Example: "All big and rough people are round."
  const m = line.match(
    /^(?:all\s+)?(.+?)\s+(people|things|animals)\s+are\s+(.+?)\.\s*$/i,
  );
  if (!m) return null;

  const modifierPart = m[1].trim();
  const nounPlural = m[2].toLowerCase();
  const tail = m[3].trim();
  const noun = nounPlural === "people" ? "person" : nounPlural === "animals" ? "animal" : "thing";

  const modifiers = modifierPart
    .replace(/\s*,\s*/g, " and ")
    .replace(/\s+and\s+/gi, " and ")
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const relative = renderRelativeAnd(modifiers);
  const head = renderCopulaPredicate(tail);
  if (!relative || !head) return null;
  return `Rule: Every ${noun} ${relative} ${head}.`;
}

function normalizeFactOrRule(sentence) {
  // Conservative normalization: only rewrite patterns we can parse deterministically.
  // If we cannot translate a line, we skip the whole example (to avoid semantic drift).
  const raw = stripLeadingIndex(sentence);
  if (!raw) return { ok: false, reason: "empty line" };

  const normalized = normalizeSentence(raw);
  const lowered = normalized.toLowerCase();

  const rewrittenDetBinary = rewriteDeterminerBinaryFact(normalized);
  if (rewrittenDetBinary) {
    return { ok: true, line: rewrittenDetBinary };
  }

  const rewrittenDetUnary = rewriteDeterminerUnaryFact(normalized);
  if (rewrittenDetUnary) {
    return { ok: true, line: rewrittenDetUnary };
  }

  if (lowered.startsWith("if ")) {
    const rewrittenIfThen = rewriteIfThenRule(normalized);
    if (rewrittenIfThen) return { ok: true, line: rewrittenIfThen };

    const rewrittenBinary = rewriteIfThingThenBinaryRule(normalized);
    if (rewrittenBinary) return { ok: true, line: rewrittenBinary };

    const rewritten = rewriteSomeoneRule(normalized);
    if (rewritten) return { ok: true, line: rewritten };

    // Reject "If someone/something ..." rules we can't translate (they typically
    // rely on variables or relation negation forms we don't support yet).
    if (/^if\s+(someone|something)\b/i.test(normalized)) {
      return { ok: false, reason: "unsupported conditional rule with variables" };
    }

    // Many ProofWriter rules are already in a CNL-compatible conditional form:
    // "If Bob is young and Bob is big then Bob is rough."
    return { ok: true, line: normalized };
  }

  if (lowered.startsWith("every ")) {
    const rewritten = rewriteEveryRule(normalized);
    if (!rewritten) return { ok: false, reason: "unsupported 'every' rule form" };
    return { ok: true, line: rewritten };
  }

  if (lowered.startsWith("all ")) {
    const rewritten = rewriteAdjectiveNounRule(normalized) || rewriteAllNounRule(normalized);
    if (!rewritten) return { ok: false, reason: "unsupported 'all' rule form" };
    return { ok: true, line: rewritten };
  }

  const rewrittenBare = rewriteAdjectiveNounRule(normalized);
  if (rewrittenBare) {
    return { ok: true, line: rewrittenBare };
  }

  if (/\bdoes\s+not\b/i.test(normalized)) {
    return { ok: false, reason: "active relation negation ('does not') is unsupported without rewrite" };
  }

  if (/^(the|a|an)\b/i.test(normalized)) {
    return { ok: false, reason: "determiner subject requires rewrite to a named entity" };
  }

  // Plain fact or relation: leave as-is.
  return { ok: true, line: normalized };
}

function normalizeQuestion(question) {
  let text = String(question || "").trim();
  if (!text) return "";
  return text;
}

function normalizeAnswer(raw) {
  const a = String(raw || "").trim().toLowerCase();
  if (a === "unknown") return { kind: "unknown" };
  if (a === "true" || a === "yes") return { kind: "bool", value: true };
  if (a === "false" || a === "no") return { kind: "bool", value: false };
  return { kind: "unsupported", value: a };
}

function questionToCondition(questionRaw) {
  const q = String(questionRaw || "").trim();
  if (!q) return null;

  if (q.endsWith(".")) {
    const res = normalizeFactOrRule(q);
    if (!res.ok) return null;
    const line = String(res.line || "").trim();
    if (!line || line.toLowerCase().startsWith("rule:") || line.toLowerCase().startsWith("if ")) return null;
    return stripTrailingDot(line);
  }

  const m1 = q.match(/^Is\s+([A-Z][A-Za-z0-9_-]*)\s+(a|an)\s+([a-z][a-z0-9_-]*)\?\s*$/i);
  if (m1) return `${m1[1]} is ${m1[2].toLowerCase()} ${m1[3]}`;

  const m3 = q.match(/^Is\s+([A-Z][A-Za-z0-9_-]*)\s+not\s+([a-z][a-z0-9_-]*)\?\s*$/i);
  if (m3) return `${m3[1]} is not ${m3[2]}`;

  const m2 = q.match(/^Is\s+([A-Z][A-Za-z0-9_-]*)\s+([a-z][a-z0-9_-]*)\?\s*$/i);
  if (m2) return `${m2[1]} is ${m2[2]}`;

  return null;
}

export function translateProofwriterMini(example) {
  const answer = normalizeAnswer(example.answer);
  if (answer.kind === "unknown") {
    return { skip: true, skipReason: "tri-valued 'unknown' not supported (skipped by DS26)" };
  }
  if (answer.kind !== "bool") {
    return { skip: true, skipReason: `unsupported answer: ${answer.value}` };
  }

  const theoryLines = splitTheoryText(example.theory);
  const normalized = [];
  const rejected = [];
  for (const line of theoryLines) {
    const res = normalizeFactOrRule(line);
    if (!res.ok) rejected.push(res.reason);
    else normalized.push(res.line);
  }

  const question = normalizeQuestion(example.question);
  const condition = questionToCondition(question);
  if (!condition) return { skip: true, skipReason: "unsupported question form" };
  if (normalized.length === 0) return { skip: true, skipReason: "missing theory" };
  if (rejected.length > 0) {
    return { skip: true, skipReason: `unsupported theory line: ${rejected[0]}` };
  }

  const cnlTheory = normalized.join("\n") + "\n";
  const cnlCommand = `Verify that ${condition}.`;
  const expected = { kind: "proof", value: answer.value };
  return { cnlTheory, cnlCommand, expected, skip: false };
}
