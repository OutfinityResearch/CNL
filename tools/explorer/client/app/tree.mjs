import { API } from "./api.mjs";
import { UI } from "./ui.mjs";
import { renderDetails } from "./details.mjs";

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
    default:
      return "📄";
  }
}

function renderTree(nodes, container, level = 0) {
  container.innerHTML = "";
  nodes.forEach((node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isFolder = node.icon === "folder";
    
    const el = document.createElement("div");
    el.className = "tree-node";
    
    // Expand/collapse icon for folders
    const expandIcon = isFolder ? '<span class="tree-toggle">−</span>' : '<span class="tree-toggle-spacer"></span>';
    const nodeIcon = isFolder ? '' : `<span class="icon">${getIcon(node.icon)}</span>`;
    
    el.innerHTML = `${expandIcon}${nodeIcon} ${node.text}`;
    
    if (!isFolder) {
      el.onclick = async (e) => {
        if (e.target.classList.contains('tree-toggle')) return;
        document.querySelectorAll(".tree-node").forEach((n) => n.classList.remove("tree-node--selected"));
        el.classList.add("tree-node--selected");

        const type = node.type || "entity";
        const denseId = node.denseId !== undefined ? node.denseId : "";
        const data = await API.getEntity(type, denseId);
        if (data && (data.entity || data.category || data.relationship || data.rule || data.action || data.details)) {
          renderDetails(data);
        } else if (data && data.error) {
          renderDetails({
            details: { name: "Error", type: "error", id: "-", relations: [], properties: [], text: data.error },
          });
        } else {
          renderDetails(null);
        }
      };
    }
    
    container.appendChild(el);
    
    if (hasChildren) {
      const childContainer = document.createElement("div");
      childContainer.className = "tree-children";
      renderTree(node.children, childContainer, level + 1);
      container.appendChild(childContainer);
      
      // Toggle expand/collapse
      if (isFolder) {
        const toggle = el.querySelector('.tree-toggle');
        toggle.onclick = (e) => {
          e.stopPropagation();
          const isCollapsed = childContainer.classList.toggle('collapsed');
          toggle.textContent = isCollapsed ? '+' : '−';
        };
      }
    }
  });
}

export async function refreshTree() {
  const data = await API.getTree();
  if (data.tree) {
    renderTree(data.tree, UI.tree);
  }
}
