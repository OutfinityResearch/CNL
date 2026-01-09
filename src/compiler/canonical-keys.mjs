export function canonicalEntityKey(node) {
  if (!node) return null;
  switch (node.kind) {
    case "Name":
      return `E:${node.value}`;
    case "NumberLiteral":
      return `E:lit:num:${node.value}`;
    case "StringLiteral":
      return `E:lit:str:${node.value}`;
    case "BooleanLiteral":
      return `E:lit:bool:${node.value ? "true" : "false"}`;
    default:
      return null;
  }
}

function formatAttributeObject(node) {
  if (!node) return "";
  if (node.kind === "Name") return node.value;
  if (node.kind === "NounPhrase") return node.core.join(" ");
  if (node.kind === "NumberLiteral") return String(node.value);
  if (node.kind === "StringLiteral") return node.value;
  if (node.kind === "BooleanLiteral") return node.value ? "true" : "false";
  return node.kind;
}

export function canonicalAttributeKey(attribute) {
  if (!attribute || attribute.kind !== "AttributeRef") return null;
  const core = attribute.core.join(" ");
  const pp = attribute.pp
    .map((item) => `${item.preposition}:${formatAttributeObject(item.object)}`)
    .join("|");
  if (!pp) return `A:${core}`;
  return `A:${core}|${pp}`;
}

export function canonicalAttributeKeyFromSelector(selector) {
  if (!selector || selector.kind !== "AttrSelector") return null;
  return `A:${selector.words.join(" ")}`;
}
