function titleCase(word) {
  const w = String(word || "").trim();
  if (!w) return w;
  return w[0].toUpperCase() + w.slice(1);
}

function normalizeRoom(word) {
  // bAbI answers are lowercase room nouns; CNL entities are Things (capitalized).
  return titleCase(word.replace(/[^a-zA-Z0-9_-]/g, ""));
}

function parseMoveSentence(line) {
  const text = String(line || "").trim();
  const m = text.match(/^([A-Z][A-Za-z0-9_-]*)\s+(?:went to|moved to|journeyed to|travelled to)\s+the\s+([a-z][a-z0-9_-]*)\.\s*$/i);
  if (!m) return null;
  return { who: titleCase(m[1]), where: normalizeRoom(m[2]) };
}

function parseWhereQuestion(question) {
  const text = String(question || "").trim();
  const m = text.match(/^Where\s+is\s+([A-Z][A-Za-z0-9_-]*)\?\s*$/i);
  if (!m) return null;
  return { who: titleCase(m[1]) };
}

export function translateBabiLocation(example) {
  const story = Array.isArray(example.story) ? example.story : [];
  const moves = story.map(parseMoveSentence).filter(Boolean);
  const q = parseWhereQuestion(example.question);
  if (!q) {
    return { skip: true, skipReason: "unsupported question template" };
  }
  if (moves.length === 0) {
    return { skip: true, skipReason: "no supported story sentences" };
  }

  // bAbI stories are sequential, but CNL KB is monotonic. We model "current location"
  // by keeping only the last location fact per entity.
  const lastLocationByWho = new Map();
  moves.forEach((m) => lastLocationByWho.set(m.who, m.where));
  const places = new Set([...lastLocationByWho.values()]);

  const lines = [];
  places.forEach((p) => lines.push(`${p} is a place.`));
  for (const [who, where] of lastLocationByWho.entries()) {
    lines.push(`${who} is located in ${where}.`);
  }

  const cnlTheory = lines.join("\n") + "\n";
  const cnlCommand = `Solve for ?P such that ${q.who} is located in ?P.`;

  const answer = normalizeRoom(example.answer);
  return {
    cnlTheory,
    cnlCommand,
    expected: { kind: "query", values: [answer] },
  };
}
