function titleCase(word) {
  const w = String(word || "").trim();
  if (!w) return w;
  return w[0].toUpperCase() + w.slice(1);
}

function normalizeRoom(word) {
  // bAbI answers are lowercase room nouns; CNL entities are Things (capitalized).
  const w = String(word || "").trim();
  return titleCase(w.replace(/[^a-zA-Z0-9_-]/g, ""));
}

function parseMoveSentence(line) {
  const text = String(line || "").trim();
  const m = text.match(
    /^([A-Z][A-Za-z0-9_-]*)\s+(?:went|moved|journeyed|travelled)\s+(?:back\s+)?to\s+(?:the\s+)?([a-z][a-z0-9_-]*)\.\s*$/i,
  );
  if (!m) return null;
  return { who: titleCase(m[1]), where: normalizeRoom(m[2]) };
}

function parseWhereQuestion(question) {
  const text = String(question || "").trim();
  const m = text.match(/^Where\s+is\s+([A-Z][A-Za-z0-9_-]*)\?\s*$/i);
  if (!m) return null;
  return { who: titleCase(m[1]) };
}

function translateBabiLocationStep(example) {
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

function isDatasetRow(example) {
  const story = example?.story;
  return (
    story &&
    typeof story === "object" &&
    Array.isArray(story.text) &&
    Array.isArray(story.type)
  );
}

function extractDatasetQuestions(example) {
  const story = example.story;
  const texts = story.text || [];
  const types = story.type || [];
  const answers = story.answer || [];

  const context = [];
  const steps = [];
  for (let i = 0; i < texts.length; i += 1) {
    const type = types[i];
    const text = texts[i];
    if (type === 0) {
      context.push(text);
      continue;
    }
    if (type === 1) {
      const answer = Array.isArray(answers) ? answers[i] : null;
      steps.push({ story: [...context], question: text, answer });
      continue;
    }
  }
  return steps;
}

export function translateBabiLocation(example) {
  if (isDatasetRow(example)) {
    const steps = extractDatasetQuestions(example);
    if (steps.length === 0) {
      return [{ skip: true, skipReason: "no question steps found in dataset row" }];
    }
    return steps.map((step) => translateBabiLocationStep(step));
  }
  return translateBabiLocationStep(example);
}
