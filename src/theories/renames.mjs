/**
 * Load-time vocabulary renames (RenameType/RenamePredicate directives).
 *
 * This module rewrites a parsed AST in-place before compilation so that legacy/external
 * theory bundles can be loaded deterministically (DS25).
 */
import { verbGroupKey, passiveKey } from "../utils/predicate-keys.mjs";

function normalizeKey(key) {
  return String(key || "").trim();
}

function verbGroupSurfaceKeys(verbGroup) {
  if (!verbGroup || verbGroup.kind !== "VerbGroup") return [];
  const parts = [verbGroup.verb, ...(verbGroup.particles || [])].filter(Boolean);
  if (parts.length === 0) return [];
  const space = parts.join(" ");
  const pipe = parts.join("|");
  return [space, pipe, verbGroupKey(verbGroup, { negated: false })].filter(Boolean);
}

function passiveSurfaceKeys(assertion) {
  if (!assertion || assertion.kind !== "PassiveRelationAssertion") return [];
  const verb = assertion.verb;
  const preposition = assertion.preposition;
  if (!verb || !preposition) return [];
  const space = `${verb} ${preposition}`;
  const pipe = `${verb}|${preposition}`;
  return [space, pipe, `passive:${pipe}`, passiveKey(verb, preposition, { negated: false })].filter(Boolean);
}

function parseVerbPhrase(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  return {
    verb: parts[0],
    particles: parts.slice(1),
  };
}

function renameStringLiteral(node, renames) {
  if (!node || node.kind !== "StringLiteral") return false;
  const key = normalizeKey(node.value);
  if (!key) return false;
  const next = renames[key];
  if (!next) return false;
  node.value = next;
  return true;
}

function renameName(node, renames) {
  if (!node || node.kind !== "Name") return false;
  const key = normalizeKey(node.value);
  if (!key) return false;
  const next = renames[key];
  if (!next) return false;
  node.value = next;
  return true;
}

function renameNounPhraseCore(node, renames) {
  if (!node || node.kind !== "NounPhrase") return false;
  const key = normalizeKey((node.core || []).join(" "));
  if (!key) return false;
  const next = renames[key];
  if (!next) return false;
  node.core = [next];
  return true;
}

function visitExpr(node, ctx) {
  if (!node || typeof node !== "object") return;

  if (node.kind === "StringLiteral") {
    return [];
  }

  if (node.kind === "Name") {
    const applied = [];
    const before = node.value;
    if (renameName(node, ctx.typeKeyRenames)) {
      applied.push({ from: before, to: node.value, where: "name" });
    }
    return applied;
  }
  if (node.kind === "NumberLiteral") return;

  if (node.kind === "NounPhrase") {
    const applied = [];
    const before = (node.core || []).join(" ");
    if (renameNounPhraseCore(node, ctx.typeKeyRenames)) {
      applied.push({ from: before, to: (node.core || []).join(" "), where: "noun-phrase-core" });
    }
    (node.pp || []).forEach((pp) => applied.push(...(visitExpr(pp.object, ctx) || [])));
    if (node.relative) applied.push(...(visitCondition(node.relative, ctx) || []));
    return applied;
  }

  if (node.kind === "VerbGroup") {
    return;
  }

  if (node.kind === "Aggregation") {
    const applied = [];
    (node.items || []).forEach((it) => applied.push(...(visitExpr(it, ctx) || [])));
    return applied;
  }

  if (node.kind === "AttributeRef") {
    return visitExpr(node.attribute, ctx);
  }
}

function renameAssertionPredicates(assertion, ctx) {
  if (!assertion || typeof assertion !== "object") return [];
  const applied = [];
  const renames = ctx.predicateKeyRenames || {};

  if (assertion.kind === "ActiveRelationAssertion") {
    const candidates = verbGroupSurfaceKeys(assertion.verbGroup);
    const next = candidates.map((k) => renames[k]).find(Boolean);
    if (next) {
      const parsed = parseVerbPhrase(next);
      if (parsed) {
        assertion.verbGroup.verb = parsed.verb;
        assertion.verbGroup.particles = parsed.particles;
        applied.push({ from: candidates[0] || "(unknown)", to: next, where: "active" });
      }
    }
    applied.push(...(visitExpr(assertion.subject, ctx) || []));
    applied.push(...(visitExpr(assertion.object, ctx) || []));
    return applied;
  }

  if (assertion.kind === "PassiveRelationAssertion") {
    const candidates = passiveSurfaceKeys(assertion);
    const next = candidates.map((k) => renames[k]).find(Boolean);
    if (next) {
      const parsed = parseVerbPhrase(next);
      if (parsed) {
        assertion.verb = parsed.verb;
        assertion.preposition = parsed.particles[0] || assertion.preposition;
        applied.push({ from: candidates[0] || "(unknown)", to: next, where: "passive" });
      }
    }
    applied.push(...(visitExpr(assertion.subject, ctx) || []));
    applied.push(...(visitExpr(assertion.object, ctx) || []));
    return applied;
  }

  if (assertion.kind === "CopulaPredicateAssertion") {
    applied.push(...(visitExpr(assertion.subject, ctx) || []));
    applied.push(...(visitExpr(assertion.complement, ctx) || []));
    return applied;
  }

  if (assertion.kind === "AttributeAssertion") {
    applied.push(...(visitExpr(assertion.subject, ctx) || []));
    applied.push(...(visitExpr(assertion.attribute, ctx) || []));
    applied.push(...(visitExpr(assertion.value, ctx) || []));
    return applied;
  }

  if (assertion.kind === "ComparisonAssertion") {
    applied.push(...(visitExpr(assertion.left, ctx) || []));
    applied.push(...(visitExpr(assertion.right, ctx) || []));
    return applied;
  }

  return applied;
}

function visitCondition(node, ctx) {
  if (!node || typeof node !== "object") return [];
  switch (node.kind) {
    case "GroupCondition":
      return visitCondition(node.inner, ctx);
    case "CaseScope":
      return visitCondition(node.operand, ctx);
    case "EitherOr":
      return [...visitCondition(node.left, ctx), ...visitCondition(node.right, ctx)];
    case "BothAnd":
      return [...visitCondition(node.left, ctx), ...visitCondition(node.right, ctx)];
    case "AndChain":
    case "OrChain":
      return (node.items || []).flatMap((it) => visitCondition(it, ctx));
    case "AtomicCondition":
      return renameAssertionPredicates(node.assertion, ctx);
    default:
      return [];
  }
}

function visitSentence(sentence, ctx) {
  if (!sentence || typeof sentence !== "object") return [];
  switch (sentence.kind) {
    case "AssertionSentence":
      return renameAssertionPredicates(sentence.assertion, ctx);
    case "BecauseSentence":
      return [...renameAssertionPredicates(sentence.assertion, ctx), ...visitCondition(sentence.because, ctx)];
    case "ConditionalSentence":
      return [...visitCondition(sentence.condition, ctx), ...visitSentence(sentence.then, ctx)];
    default:
      return [];
  }
}

function isBaseDictionaryStatement(item, currentContext) {
  if (!item) return false;
  if (currentContext === "BaseDictionary") return true;
  return false;
}

function normalizeCore(node) {
  if (!node || node.kind !== "NounPhrase") return [];
  return node.core.flatMap((item) => item.toLowerCase().split(/\s+/).filter(Boolean));
}

function coreHas(core, word) {
  return core.includes(word);
}

function extractOfObject(np) {
  if (!np || np.kind !== "NounPhrase") return null;
  const found = np.pp.find((pp) => pp.preposition === "of");
  return found ? found.object : null;
}

function renameDictionaryAssertion(assertion, ctx) {
  if (!assertion || assertion.kind !== "CopulaPredicateAssertion") return [];
  const applied = [];

  // 1) Declarations: "<key>" is a type / predicate / attribute.
  if (assertion.subject?.kind === "StringLiteral" && assertion.complement?.kind === "NounPhrase") {
    const declKey = assertion.subject.value;
    const core = normalizeCore(assertion.complement);
    const isPredicateDecl = coreHas(core, "predicate");
    const isTypeDecl = coreHas(core, "type") || coreHas(core, "subtype");
    const isAttributeDecl = coreHas(core, "attribute");

    if (isPredicateDecl) {
      const isBinary = coreHas(core, "binary");
      if (isBinary) {
        if (renameStringLiteral(assertion.subject, ctx.predicateKeyRenames)) {
          applied.push({ from: declKey, to: assertion.subject.value, where: "dictionary-binary-predicate-decl" });
        }
      }
      return applied;
    }

    if (isTypeDecl) {
      if (renameStringLiteral(assertion.subject, ctx.typeKeyRenames)) {
        applied.push({ from: declKey, to: assertion.subject.value, where: "dictionary-type-decl" });
      }
      const parentNode = extractOfObject(assertion.complement);
      if (parentNode?.kind === "StringLiteral") {
        const beforeParent = parentNode.value;
        if (renameStringLiteral(parentNode, ctx.typeKeyRenames)) {
          applied.push({ from: beforeParent, to: parentNode.value, where: "dictionary-subtype-parent" });
        }
      }
      return applied;
    }

    if (isAttributeDecl) {
      // Attributes are not renamed by DS25 (for now).
      return applied;
    }
  }

  // 2) Domain/Range: the domain/range of "<pred>" is "<type>".
  if (assertion.subject?.kind === "NounPhrase") {
    const core = normalizeCore(assertion.subject);
    const isDomain = coreHas(core, "domain");
    const isRange = coreHas(core, "range");
    if (isDomain || isRange) {
      const predicateNode = extractOfObject(assertion.subject);
      if (predicateNode?.kind === "StringLiteral") {
        const before = predicateNode.value;
        if (renameStringLiteral(predicateNode, ctx.predicateKeyRenames)) {
          applied.push({ from: before, to: predicateNode.value, where: "dictionary-domain-range-predicate" });
        }
      }

      if (assertion.complement?.kind === "StringLiteral") {
        const before = assertion.complement.value;
        if (renameStringLiteral(assertion.complement, ctx.typeKeyRenames)) {
          applied.push({ from: before, to: assertion.complement.value, where: "dictionary-domain-range-type" });
        }
      }
      return applied;
    }
  }

  // 3) Comparator: the comparator of "<attribute>" is "<literal>".
  // (Not rewritten by DS25 for now.)
  return applied;
}

export function applyLoadTimeRenames(program, options = {}) {
  const predicateKeyRenames = options.predicateKeyRenames || {};
  const typeKeyRenames = options.typeKeyRenames || {};
  const enabled = Object.keys(predicateKeyRenames).length > 0 || Object.keys(typeKeyRenames).length > 0;
  if (!enabled) return { program, appliedIssues: [] };
  if (!program || program.kind !== "Program") return { program, appliedIssues: [] };

  const applied = [];
  let currentContext = null;

  for (const item of program.items || []) {
    if (item.kind === "ContextDirective") {
      currentContext = item.name;
      continue;
    }

    const ctx = {
      predicateKeyRenames,
      typeKeyRenames,
    };

    if (isBaseDictionaryStatement(item, currentContext)) {
      if (item.kind === "Statement" && item.sentence?.kind === "AssertionSentence") {
        applied.push(...renameDictionaryAssertion(item.sentence.assertion, ctx));
      }
      continue;
    }

    if (item.kind === "Statement" || item.kind === "RuleStatement") {
      applied.push(...visitSentence(item.sentence, ctx));
      continue;
    }

    if (item.kind === "TransitionRuleStatement") {
      applied.push(...visitCondition(item.event, ctx));
      applied.push(...visitSentence(item.effect, ctx));
      continue;
    }
  }

  const byPair = new Map(); // from->to -> count
  for (const a of applied) {
    const k = `${a.from} -> ${a.to}`;
    byPair.set(k, (byPair.get(k) ?? 0) + 1);
  }

  const appliedIssues = [...byPair.entries()].map(([pair, count]) => {
    const [from, to] = pair.split(" -> ");
    return {
      kind: "LoadTimeRenameApplied",
      severity: "warning",
      key: from,
      message: `Load-time rename applied: '${from}' -> '${to}' (${count} occurrence${count === 1 ? "" : "s"}).`,
      details: { from, to, count },
    };
  });

  return { program, appliedIssues };
}
