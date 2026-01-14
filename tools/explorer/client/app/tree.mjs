import { API } from "./api.mjs";
import { UI } from "./ui.mjs";
import { renderDetails } from "./details.mjs";
import { registerTreeNode, resetTreeIndex } from "./tree-navigator.mjs";

function getIcon(name) {
  switch (name) {
    case "user":
      return "👤";
    case "tag":
      return "🏷️";
    case "link":
      return "🔗";
    case "rule":
      return "📋";
    case "action":
      return "⚡";
    case "alert":
      return "⚠️";
    default:
      return "📄";
  }
}

function renderTree(nodes, container, parentId = null) {
  container.innerHTML = "";
  nodes.forEach((node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isFolder = hasChildren;
    
    const el = document.createElement("div");
    el.className = "tree-node";
    if (node.tooltip) el.title = node.tooltip;
    
    // Expand/collapse icon for folders with children
    const expandIcon = isFolder && hasChildren ? '<span class="tree-toggle">−</span>' : '<span class="tree-toggle-spacer"></span>';
    const iconName = node.icon && node.icon !== "folder" ? node.icon : null;
    const nodeIcon = iconName ? `<span class="icon">${getIcon(iconName)}</span>` : '';
    
    el.innerHTML = `${expandIcon}${nodeIcon} ${node.text}`;
    
    el.onclick = async (e) => {
      if (e.target.classList.contains("tree-toggle")) return;
      document.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("tree-node--selected"));
      el.classList.add("tree-node--selected");

      // Preferred: server-provided open action metadata (no client-side heuristics).
      if (node.open && node.open.type) {
        if (node.open.type === "overview") {
          const data = await API.getOverview(node.open.kind, node.open.id);
          if (data && data.overview) return renderDetails(data);
          return renderDetails({
            details: { name: "Error", type: "error", id: "-", relations: [], properties: [], text: data?.error || "Failed to load overview." },
          });
        }
        if (node.open.type === "entity") {
          const data = await API.getEntity(node.open.entityType || "entity", node.open.id);
          if (data && (data.entity || data.category || data.relationship || data.rule || data.action || data.details || data.overview)) {
            return renderDetails(data);
          }
          if (data && data.error) {
            return renderDetails({
              details: { name: "Error", type: "error", id: "-", relations: [], properties: [], text: data.error },
            });
          }
          return renderDetails(null);
        }
      }

      // 1. Top-level static folders
      const map = {
        things: "things",
        concepts: "concepts",
        relations: "relations",
        rules: "rules",
        transitions: "transitions",
        warnings: "warnings",
        actions: "actions",
        symbols: "symbols",
      };
      
      if (map[node.id]) {
        const overviewKind = map[node.id];
        const data = await API.getOverview(overviewKind);
        if (data && data.overview) {
          renderDetails(data);
        } else {
          renderDetails({
            details: { name: "Error", type: "error", id: "-", relations: [], properties: [], text: data?.error || "Failed to load overview." },
          });
        }
        return;
      }

      // 2. Intermediate / Scoped Groups
      if (
        node.id.startsWith("rule-group-") || 
        node.id.startsWith("w-group-") ||
        node.id.match(/^p-\d+$/) ||
        node.id.match(/^p-\d+-s-/)
      ) {
        // It's a scoped group. Fetch scoped overview.
        // We need an API method for this. API.getOverview accepts 'kind'. 
        // We'll extend API.getOverview to accept an ID or create a new method?
        // Let's assume API.getScopedOverview(id) exists or we use getOverview('scoped', id).
        // For now, let's hack it into API.getOverview or add it to API.
        
        // I will modify API.getOverview in api.mjs to accept an optional ID.
        const data = await API.getOverview("scoped", node.id);
        if (data && data.overview) {
          renderDetails(data);
        } else {
           renderDetails({ details: { name: "Group", type: "info", text: "No summary available." } });
        }
        return;
      }

      // 3. Leaf Nodes (Entities, Rules, etc.)
      const type = node.type || "entity";
      const denseId = node.denseId !== undefined ? node.denseId : "";
      const data = await API.getEntity(type, denseId);
      if (data && (data.entity || data.category || data.relationship || data.rule || data.action || data.details || data.overview)) {
        renderDetails(data);
      } else if (data && data.error) {
        renderDetails({
          details: { name: "Error", type: "error", id: "-", relations: [], properties: [], text: data.error },
        });
      } else {
        renderDetails(null);
      }
    };
    
    container.appendChild(el);
    
    if (hasChildren) {
      const childContainer = document.createElement("div");
      childContainer.className = "tree-children";
      if (!node.expanded) {
        childContainer.classList.add("collapsed");
      }
      renderTree(node.children, childContainer, node.id);
      container.appendChild(childContainer);
      
      // Toggle expand/collapse
      if (isFolder) {
        const toggle = el.querySelector('.tree-toggle');
        toggle.textContent = node.expanded ? '−' : '+';
        toggle.onclick = (e) => {
          e.stopPropagation();
          const isCollapsed = childContainer.classList.toggle('collapsed');
          toggle.textContent = isCollapsed ? '+' : '−';
        };
        registerTreeNode(node, el, { parentId, childContainer, toggleEl: toggle });
      } else {
        registerTreeNode(node, el, { parentId, childContainer });
      }
    } else {
      registerTreeNode(node, el, { parentId });
    }
  });
}

export async function refreshTree() {
  const data = await API.getTree();
  if (data.tree) {
    resetTreeIndex();
    renderTree(data.tree, UI.tree);
  }
}
