function normalizeSentence(line) {
  let text = String(line || "").trim();
  if (!text) return "";
  if (!text.endsWith(".")) text += ".";
  return text;
}

function normalizeFactOrRule(sentence) {
  // Minimal normalization: keep sentences CNL-compatible where possible.
  // We accept:
  // - "Anne is a tiger."
  // - "Every tiger is fierce."
  return normalizeSentence(sentence);
}

function normalizeQuestion(question) {
  let text = String(question || "").trim();
  if (!text) return "";
  if (!text.endsWith(".")) text += ".";
  return text;
}

export function translateProofwriterMini(example) {
  const answer = String(example.answer || "").trim().toLowerCase();
  if (answer === "unknown") {
    return { skip: true, skipReason: "tri-valued 'unknown' not supported (skipped by DS26)" };
  }
  if (answer !== "yes" && answer !== "no") {
    return { skip: true, skipReason: `unsupported answer: ${answer}` };
  }

  const theoryLines = Array.isArray(example.theory) ? example.theory.map(normalizeFactOrRule).filter(Boolean) : [];
  const question = normalizeQuestion(example.question);
  if (!question) return { skip: true, skipReason: "missing question" };
  if (theoryLines.length === 0) return { skip: true, skipReason: "missing theory" };

  const cnlTheory = theoryLines.join("\n") + "\n";
  const cnlCommand = `Verify that ${question}`;
  const expected = { kind: "proof", value: answer === "yes" };
  return { cnlTheory, cnlCommand, expected, skip: false };
}

