function normalizeVerbLike(verb) {
  const v = String(verb || "").trim().toLowerCase();
  if (!v) return v;
  if (v.endsWith("ies") && v.length > 3) return `${v.slice(0, -3)}y`;
  if (v.endsWith("oes") && v.length > 3) return v.slice(0, -2); // "goes" -> "go"
  if (v.endsWith("ches") || v.endsWith("shes") || v.endsWith("xes")) return v.slice(0, -2); // drop "es"
  if (v.endsWith("sses") || v.endsWith("zzes")) return v.slice(0, -2); // "kisses" -> "kiss"
  if (v.endsWith("s") && !v.endsWith("ss") && v.length > 1) return v.slice(0, -1);
  return v;
}

export function verbGroupKey(verbGroup, options = {}) {
  if (!verbGroup || verbGroup.kind !== "VerbGroup") return null;
  const parts = [];
  if (verbGroup.auxiliary) parts.push(`aux:${verbGroup.auxiliary}`);
  parts.push(normalizeVerbLike(verbGroup.verb));
  (verbGroup.particles || []).forEach((p) => parts.push(p));
  const base = `P:${parts.join("|")}`;
  if (!options?.negated) return base;
  return base.replace(/^P:/, "P:not|");
}

export function passiveKey(verb, preposition, options = {}) {
  if (!verb || !preposition) return null;
  const base = `P:passive:${verb}|${preposition}`;
  if (!options?.negated) return base;
  return base.replace(/^P:/, "P:not|");
}
