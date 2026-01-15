export function renderNodeText(node) {
  if (!node) return "";
  if (node.kind === "Name") return node.value;
  if (node.kind === "Variable") return `?${node.name}`;
  if (node.kind === "StringLiteral") return `"${node.value}"`;
  if (node.kind === "NumberLiteral") return String(node.value);
  if (node.kind === "BooleanLiteral") return node.value ? "true" : "false";
  if (node.kind === "NounPhrase") {
    const prefix =
      node.prefix?.kind === "Determiner"
        ? node.prefix.value
        : node.prefix?.kind === "Quantifier"
          ? node.prefix.q + (node.prefix.n !== null ? ` ${node.prefix.n}` : "")
          : "";
    const core = Array.isArray(node.core) ? node.core.join(" ") : "";
    const pp = Array.isArray(node.pp)
      ? node.pp
          .map((p) => `${p.preposition} ${renderNodeText(p.object)}`.trim())
          .filter(Boolean)
          .join(" ")
      : "";
    const parts = [prefix, core, pp].filter(Boolean);
    return parts.join(" ").trim();
  }
  if (node.kind === "VerbGroup") {
    const parts = [];
    if (node.auxiliary) parts.push(node.auxiliary);
    if (node.verb) parts.push(node.verb);
    if (Array.isArray(node.particles) && node.particles.length) parts.push(node.particles.join(" "));
    return parts.join(" ").trim();
  }
  if (node.kind === "AttrSelector" && Array.isArray(node.words)) {
    return node.words.join(" ");
  }
  return node.value ?? node.name ?? node.kind ?? "";
}

export function renderAssertionText(assertion) {
  if (!assertion) return "";
  switch (assertion.kind) {
    case "CopulaPredicateAssertion":
      return `${renderNodeText(assertion.subject)} ${assertion.copula} ${renderNodeText(assertion.complement)}`.trim();
    case "ActiveRelationAssertion":
      if (assertion.negated) {
        return `${renderNodeText(assertion.subject)} does not ${renderNodeText(assertion.verbGroup)} ${renderNodeText(assertion.object)}`.trim();
      }
      return `${renderNodeText(assertion.subject)} ${renderNodeText(assertion.verbGroup)} ${renderNodeText(assertion.object)}`.trim();
    case "PassiveRelationAssertion":
      return `${renderNodeText(assertion.subject)} ${assertion.copula} ${assertion.verb} ${assertion.preposition} ${renderNodeText(assertion.object)}`.trim();
    case "AttributeAssertion": {
      const det = assertion.determiner ?? "a";
      const val = assertion.value ? ` of ${renderNodeText(assertion.value)}` : "";
      return `${renderNodeText(assertion.subject)} has ${det} ${renderNodeText(assertion.attribute)}${val}`.trim();
    }
    case "ComparisonAssertion":
      return `${renderNodeText(assertion.left)} is ${assertion.comparator?.op} ${renderNodeText(assertion.right)}`.trim();
    default:
      return assertion.kind || "";
  }
}

export function renderConditionText(condition) {
  if (!condition) return "";
  switch (condition.kind) {
    case "AtomicCondition":
      return renderAssertionText(condition.assertion);
    case "AndChain":
      return (condition.items ?? []).map(renderConditionText).filter(Boolean).join(" and ");
    case "OrChain":
      return (condition.items ?? []).map(renderConditionText).filter(Boolean).join(" or ");
    case "EitherOr":
      return [renderConditionText(condition.left), renderConditionText(condition.right)].filter(Boolean).join(" or ");
    case "BothAnd":
      return [renderConditionText(condition.left), renderConditionText(condition.right)].filter(Boolean).join(" and ");
    case "CaseScope":
      if (condition.mode === "negative") return `it is not the case that (${renderConditionText(condition.operand)})`;
      return renderConditionText(condition.operand);
    case "GroupCondition":
      return `(${renderConditionText(condition.inner)})`;
    default:
      return condition.kind || "";
  }
}

export function renderSentenceText(sentence) {
  if (!sentence) return "";
  if (sentence.kind === "AssertionSentence") return renderAssertionText(sentence.assertion);
  if (sentence.kind === "BecauseSentence") {
    const assertion = renderAssertionText(sentence.assertion);
    const because = renderConditionText(sentence.because);
    if (!because) return assertion;
    return `${assertion} because ${because}`.trim();
  }
  return sentence.kind || "";
}
