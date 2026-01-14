import crypto from "node:crypto";

export function isIri(value) {
  return typeof value === "string" && value.startsWith("http");
}

export function localNameFromIri(iri) {
  if (!iri) return "";
  const cleaned = String(iri).replace(/[\/#]+$/, "");
  const hashIdx = cleaned.lastIndexOf("#");
  const slashIdx = cleaned.lastIndexOf("/");
  const idx = Math.max(hashIdx, slashIdx);
  const name = idx >= 0 ? cleaned.slice(idx + 1) : cleaned;
  return name || cleaned;
}

function splitWords(raw) {
  if (!raw) return [];
  const cleaned = String(raw)
    .replace(/[_]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const parts = cleaned.split(" ");
  const words = [];
  for (const part of parts) {
    if (!part) continue;
    // Insert boundaries: "camelCase" -> "camel Case", "XMLThing" -> "XML Thing"
    const spaced = part
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    spaced.split(" ").forEach((w) => {
      if (w) words.push(w);
    });
  }
  return words;
}

function normalizeWord(word) {
  const ascii = String(word)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return ascii
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "")
    .toLowerCase();
}

export function normalizeTypeKey(iriOrLabel) {
  const words = splitWords(iriOrLabel);
  const normalized = words.map(normalizeWord).filter(Boolean).join("-");
  if (normalized) return normalized;
  const hash = crypto.createHash("sha1").update(String(iriOrLabel)).digest("hex").slice(0, 10);
  return `term-${hash}`;
}

export function normalizePredicatePhrase(iriOrLabel, options = {}) {
  const words = splitWords(iriOrLabel).map(normalizeWord).filter(Boolean);
  if (words[0] === "is") words.shift();
  if (words.length === 0) return { phrase: "related-to", style: "active", verbToken: "related-to", particles: [] };

  const startsWithLetter = (token) => /^[a-z_]/.test(String(token || ""));

  // Many OWL properties are named like "hasBeginning"/"hasPart". We cannot emit
  // `X has beginning Y` because `has` is reserved for attributes in the CNL grammar.
  // Instead, keep a single verb token like `has-beginning` which is parseable and stable.
  if (words[0] === "has" && words.length >= 2) {
    const token = `has-${words.slice(1).join("-")}` || "has-relation";
    return { phrase: token, style: "active", verbToken: token, particles: [] };
  }

  const passiveAllowlist = new Set([
    "located",
    "part",
    "member",
    "inside",
    "adjacent",
    "prior",
    "subsequent",
    "assigned",
    "connected",
    "contained",
  ]);

  const prepositions = options.prepositions ?? new Set();
  const first = words[0];
  const second = words[1] ?? null;
  const isPassiveCandidate =
    words.length === 2 &&
    second &&
    prepositions.has(second) &&
    (first.endsWith("ed") || passiveAllowlist.has(first));

  if (isPassiveCandidate) {
    const phrase = `${first} ${second}`;
    return { phrase, style: "passive", verbToken: first, particles: [second] };
  }

  // Default: active verb phrase, using particles if present.
  const phrase = words.join(" ");
  const verb = words[0];
  const particles = words.slice(1);

  // If the verb would be a keyword in our grammar, fall back to a single hyphenated token.
  const keywords = options.keywords ?? new Set();
  if (keywords.has(verb)) {
    const token = `rel-${words.join("-")}` || "related-to";
    return { phrase: token, style: "active", verbToken: token, particles: [] };
  }

  // The CNL condition grammar is conservative about allowing "particles".
  // Keep multi-word predicates only when the particle is a single preposition
  // (e.g. "believes in", "prior to"). Otherwise, collapse to a single token.
  if (particles.length > 0) {
    const allowParticles =
      particles.length === 1 && prepositions.has(particles[0]);
    if (!allowParticles) {
      const token = (startsWithLetter(words[0]) ? words.join("-") : `rel-${words.join("-")}`) || "related-to";
      return { phrase: token, style: "active", verbToken: token, particles: [] };
    }
  }

  // Verb tokens must start with a letter/underscore in the CNL lexer.
  if (!startsWithLetter(verb)) {
    const token = `rel-${words.join("-")}` || "related-to";
    return { phrase: token, style: "active", verbToken: token, particles: [] };
  }

  return { phrase, style: "active", verbToken: verb, particles };
}
