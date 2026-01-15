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

function normalizeVerb(rawVerb) {
  const verb = String(rawVerb || "").trim().toLowerCase();
  if (!verb) return verb;
  if (verb.endsWith("ies") && verb.length > 3) return `${verb.slice(0, -3)}y`;
  if (verb.endsWith("oes") && verb.length > 3) return verb.slice(0, -2); // "goes" -> "go"
  if (verb.endsWith("ches") || verb.endsWith("shes") || verb.endsWith("xes")) return verb.slice(0, -2); // drop "es"
  if (verb.endsWith("sses") || verb.endsWith("zzes")) return verb.slice(0, -2); // "kisses" -> "kiss"
  if (verb.endsWith("s") && !verb.endsWith("ss") && verb.length > 1) return verb.slice(0, -1);
  return verb;
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

const VAR_SUBJECTS = new Set(["someone", "something", "it", "they"]);

function stripDeterminer(phrase) {
  return String(phrase || "").trim().replace(/^(the|a|an)\s+/i, "").trim();
}

function normalizeUnaryTailForCopula(tail) {
  // Keep "a/an" typing if present; otherwise normalize as a predicate name.
  const t = String(tail || "").trim();
  if (!t) return null;
  if (/^(a|an)\s+/i.test(t)) return t.toLowerCase().startsWith("an ") ? `an ${t.slice(3).trim()}` : `a ${t.slice(2).trim()}`;
  return normalizePredicateTail(t);
}

function classifyEntityOrVar(raw) {
  const stripped = stripDeterminer(raw);
  if (!stripped) return null;
  const lower = stripped.toLowerCase();
  if (VAR_SUBJECTS.has(lower)) return { kind: "var", token: lower };
  const name = normalizeEntityPhrase(stripped);
  if (!name) return null;
  return { kind: "const", name };
}

function parseEnglishClause(clauseText) {
  const text = stripTrailingDot(String(clauseText || "").trim());
  if (!text) return null;

  const unary = text.match(/^(.+?)\s+(?:is|are)\s+(not\s+)?(.+?)$/i);
  if (unary) {
    const subject = classifyEntityOrVar(unary[1]);
    const negated = Boolean(unary[2]);
    const tail = String(unary[3] || "").trim();
    if (!subject || !tail) return null;
    return { kind: "unary", subject, negated, tail };
  }

  // Prefer determiner-bounded parsing to avoid mis-splitting multi-word subjects:
  // "the bald eagle chases the cat" (verb must precede object determiner).
  const negDet = text.match(/^(.+?)\s+(?:does|do)\s+not\s+([a-z][a-z0-9_-]*)\s+(?:the|a|an)\s+(.+?)$/i);
  if (negDet) {
    const subject = classifyEntityOrVar(negDet[1]);
    const verb = normalizeVerb(negDet[2]);
    const object = classifyEntityOrVar(negDet[3]);
    if (!subject || !verb || !object) return null;
    return { kind: "binary", subject, negated: true, verb, object };
  }

  const posDet = text.match(/^(.+?)\s+([a-z][a-z0-9_-]*)\s+(?:the|a|an)\s+(.+?)$/i);
  if (posDet) {
    const subject = classifyEntityOrVar(posDet[1]);
    const verb = normalizeVerb(posDet[2]);
    const object = classifyEntityOrVar(posDet[3]);
    if (!subject || !verb || !object) return null;
    return { kind: "binary", subject, negated: false, verb, object };
  }

  // Fallback for already-normalized CNL-ish lines (single-token subject).
  const negBare = text.match(/^([A-Za-z0-9_-]+)\s+(?:does|do)\s+not\s+([a-z][a-z0-9_-]*)\s+(.+?)$/i);
  if (negBare) {
    const subject = classifyEntityOrVar(negBare[1]);
    const verb = normalizeVerb(negBare[2]);
    const object = classifyEntityOrVar(negBare[3]);
    if (!subject || !verb || !object) return null;
    return { kind: "binary", subject, negated: true, verb, object };
  }

  const posBare = text.match(/^([A-Za-z0-9_-]+)\s+([a-z][a-z0-9_-]*)\s+(.+?)$/i);
  if (posBare) {
    const subject = classifyEntityOrVar(posBare[1]);
    const verb = normalizeVerb(posBare[2]);
    const object = classifyEntityOrVar(posBare[3]);
    if (!subject || !verb || !object) return null;
    return { kind: "binary", subject, negated: false, verb, object };
  }

  return null;
}

function unaryTailsToPredicates(tailText, { negated: clauseNegated } = {}) {
  const tails = splitConjunctionPredicates(tailText);
  const items = [];
  for (const raw of tails) {
    let text = String(raw || "").trim();
    if (!text) return null;
    let negated = Boolean(clauseNegated);
    if (text.toLowerCase().startsWith("not ")) {
      negated = true;
      text = text.slice(4).trim();
    }
    const normalized = normalizeUnaryTailForCopula(text);
    if (!normalized) return null;
    items.push({ negated, tail: normalized });
  }
  return items;
}

function isVarIntro(token) {
  return token === "someone" || token === "something";
}

function rewriteIfThenRule(line) {
  const parsed = parseIfThenRuleLine(line);
  if (!parsed) return null;

  const condPieces = splitOnAndChain(parsed.ifPart);
  const thenClause = parseEnglishClause(parsed.thenPart);
  if (!thenClause) return null;

  const mentionsVar =
    (thenClause.subject.kind === "var") ||
    condPieces.some((p) => {
      const c = parseEnglishClause(p);
      return c?.subject?.kind === "var";
    });

  // A) Universal monadic rules: "If something ... then it ..."
  if (mentionsVar) {
    const constraints = [];
    let domain = null;
    let allowUnaryTailFragment = false;

    for (const piece of condPieces) {
      const clause = parseEnglishClause(piece);
      if (clause) {
        if (clause.subject.kind !== "var") return null; // multi-subject rule unsupported
        if (isVarIntro(clause.subject.token)) {
          domain = clause.subject.token === "someone" ? "person" : "thing";
        }
        if (clause.kind === "unary") {
          const preds = unaryTailsToPredicates(clause.tail, { negated: clause.negated });
          if (!preds) return null;
          for (const p of preds) constraints.push({ kind: "unary", ...p });
          allowUnaryTailFragment = true;
          continue;
        }
        if (clause.kind === "binary") {
          if (clause.object.kind !== "const") return null;
          constraints.push({ kind: "binary", negated: clause.negated, verb: clause.verb, object: clause.object.name });
          allowUnaryTailFragment = false;
          continue;
        }
        return null;
      }

      if (allowUnaryTailFragment) {
        const preds = unaryTailsToPredicates(piece, { negated: false });
        if (!preds) return null;
        for (const p of preds) constraints.push({ kind: "unary", ...p });
        continue;
      }

      return null;
    }

    if (!domain) return null; // require an explicit "someone/something" introduction

    if (thenClause.subject.kind !== "var") return null;
    if (thenClause.object && thenClause.object.kind === "var") return null;

    const relParts = [];
    for (const c of constraints) {
      if (c.kind === "unary") {
        relParts.push(`that is ${c.negated ? "not " : ""}${c.tail}`.trim());
      } else if (c.kind === "binary") {
        relParts.push(`that ${c.negated ? "does not " : ""}${c.verb} ${c.object}`.trim());
      } else {
        return null;
      }
    }

    const subject = relParts.length ? `Every ${domain} ${relParts.join(" and ")}` : `Every ${domain}`;

    if (thenClause.kind === "unary") {
      const preds = unaryTailsToPredicates(thenClause.tail, { negated: thenClause.negated });
      if (!preds || preds.length !== 1) return null; // head must be a single assertion
      const head = `is ${preds[0].negated ? "not " : ""}${preds[0].tail}`.trim();
      return `Rule: ${subject} ${head}.`;
    }

    if (thenClause.kind === "binary") {
      if (thenClause.object.kind !== "const") return null;
      const head = `${thenClause.negated ? "does not " : ""}${thenClause.verb} ${thenClause.object.name}`.trim();
      return `Rule: ${subject} ${head}.`;
    }

    return null;
  }

  // B) Ground rules: "If Bob ... then Bob ..."
  const condAtoms = [];
  let anchor = null;
  let allowUnaryTailFragment = false;

  for (const piece of condPieces) {
    const clause = parseEnglishClause(piece);
    if (clause) {
      if (clause.subject.kind !== "const") return null;
      if (clause.object && clause.object.kind !== "const") return null;
      if (anchor && clause.subject.name !== anchor) return null;
      anchor = anchor ?? clause.subject.name;

      if (clause.kind === "unary") {
        const preds = unaryTailsToPredicates(clause.tail, { negated: clause.negated });
        if (!preds) return null;
        for (const p of preds) condAtoms.push(`${anchor} is ${p.negated ? "not " : ""}${p.tail}`.trim());
        allowUnaryTailFragment = true;
        continue;
      }

      if (clause.kind === "binary") {
        if (clause.object.kind !== "const") return null;
        condAtoms.push(`${anchor} ${clause.negated ? "does not " : ""}${clause.verb} ${clause.object.name}`.trim());
        allowUnaryTailFragment = false;
        continue;
      }
      return null;
    }

    if (allowUnaryTailFragment && anchor) {
      const preds = unaryTailsToPredicates(piece, { negated: false });
      if (!preds) return null;
      for (const p of preds) condAtoms.push(`${anchor} is ${p.negated ? "not " : ""}${p.tail}`.trim());
      continue;
    }

    return null;
  }

  if (!anchor) return null;
  if (thenClause.subject.kind !== "const") return null;
  if (thenClause.subject.name !== anchor) return null;
  if (thenClause.object && thenClause.object.kind !== "const") return null;

  if (thenClause.kind === "unary") {
    const preds = unaryTailsToPredicates(thenClause.tail, { negated: thenClause.negated });
    if (!preds || preds.length !== 1) return null;
    const headAtom = `${anchor} is ${preds[0].negated ? "not " : ""}${preds[0].tail}`.trim();
    return `Rule: If ${condAtoms.join(" and ")} then ${headAtom}.`;
  }

  if (thenClause.kind === "binary") {
    if (thenClause.object.kind !== "const") return null;
    const headAtom = `${anchor} ${thenClause.negated ? "does not " : ""}${thenClause.verb} ${thenClause.object.name}`.trim();
    return `Rule: If ${condAtoms.join(" and ")} then ${headAtom}.`;
  }

  return null;
}

function rewriteDeterminerUnaryFact(line) {
  const m = line.match(/^(the|a|an)\s+(.+?)\s+is\s+(not\s+)?(.+?)\.\s*$/i);
  if (!m) return null;
  const subject = normalizeEntityPhrase(m[2]);
  if (!subject) return null;
  const neg = Boolean(m[3]);
  const tail = normalizeUnaryTailForCopula(m[4]);
  if (!tail) return null;
  return `${subject} is ${neg ? "not " : ""}${tail}.`.trim();
}

function rewriteDeterminerBinaryFact(line) {
  const m = line.match(
    /^(the|a|an)\s+(.+?)\s+(does\s+not\s+)?([a-z][a-z0-9_-]*)\s+(the|a|an)\s+(.+?)\.\s*$/i,
  );
  if (!m) return null;
  const subject = normalizeEntityPhrase(m[2]);
  const object = normalizeEntityPhrase(m[6]);
  const verb = normalizeVerb(m[4]);
  if (!subject || !object || !verb) return null;
  const neg = Boolean(m[3]);
  return `${subject} ${neg ? "does not " : ""}${verb} ${object}.`;
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
    if (!rewrittenIfThen) return { ok: false, reason: "unsupported if/then rule form" };
    return { ok: true, line: rewrittenIfThen };
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
  if (answer.kind !== "bool" && answer.kind !== "unknown") {
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
  const expected = { kind: "proof", value: answer.kind === "unknown" ? "unknown" : answer.value };
  return { cnlTheory, cnlCommand, expected, skip: false };
}
