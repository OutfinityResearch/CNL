function openKey(open) {
  if (!open || !open.type) return "";
  if (open.type === "entity") return `entity:${open.entityType}:${open.id}`;
  if (open.type === "overview") return `overview:${open.kind}:${open.id || ""}`;
  return `${open.type}`;
}

const indexById = new Map(); // nodeId -> { node, el, parentId, childContainer, toggleEl }
const indexByOpenKey = new Map(); // openKey -> nodeId

export function resetTreeIndex() {
  indexById.clear();
  indexByOpenKey.clear();
}

export function registerTreeNode(node, el, { parentId = null, childContainer = null, toggleEl = null } = {}) {
  if (!node || !node.id || !el) return;
  indexById.set(node.id, { node, el, parentId, childContainer, toggleEl });
  const key = openKey(node.open);
  if (key) indexByOpenKey.set(key, node.id);
}

function expandNode(nodeId) {
  const entry = indexById.get(nodeId);
  if (!entry) return;
  if (entry.childContainer) {
    entry.childContainer.classList.remove("collapsed");
    if (entry.toggleEl) entry.toggleEl.textContent = "−";
  }
}

function expandAncestors(nodeId) {
  let current = indexById.get(nodeId);
  while (current && current.parentId) {
    expandNode(current.parentId);
    current = indexById.get(current.parentId);
  }
}

export function revealTreeNodeById(nodeId) {
  const entry = indexById.get(nodeId);
  if (!entry) return false;
  expandAncestors(nodeId);
  entry.el.scrollIntoView({ block: "center" });
  entry.el.click();
  return true;
}

export function revealTreeNodeByOpen(open) {
  const key = openKey(open);
  if (!key) return false;
  const nodeId = indexByOpenKey.get(key);
  if (!nodeId) return false;
  return revealTreeNodeById(nodeId);
}

