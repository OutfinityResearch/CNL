import { API } from "./api.mjs";

let currentScale = 1;
let currentTranslate = { x: 0, y: 0 };
let selectedNodeId = null;

const NODE_COLORS = {
  thing: "#3498db",
  concept: "#9b59b6",
  symbol: "#9b59b6",
};

const NODE_WIDTH = 120;
const NODE_HEIGHT = 28;
const COL_GAP = 160;
const ROW_GAP = 12;

function idKey(id) {
  return String(id);
}

export function computeConnectedSubgraph(startNodeId, edges) {
  const start = idKey(startNodeId);
  const outgoing = new Map(); // nodeId -> edgeIdx[]
  const incoming = new Map(); // nodeId -> edgeIdx[]
  for (let i = 0; i < (edges?.length ?? 0); i += 1) {
    const e = edges[i];
    if (!e) continue;
    const s = idKey(e.source);
    const t = idKey(e.target);
    if (!outgoing.has(s)) outgoing.set(s, []);
    if (!incoming.has(t)) incoming.set(t, []);
    outgoing.get(s).push(i);
    incoming.get(t).push(i);
  }

  function bfs(startId, adjacency, step) {
    const nodes = new Set([startId]);
    const edgeIds = new Set();
    const queue = [startId];
    while (queue.length) {
      const curr = queue.shift();
      const list = adjacency.get(curr) ?? [];
      for (const edgeIdx of list) {
        if (!Number.isInteger(edgeIdx)) continue;
        const e = edges[edgeIdx];
        if (!e) continue;
        edgeIds.add(edgeIdx);
        const nextNode = step(curr, e);
        if (nextNode === null) continue;
        const k = idKey(nextNode);
        if (!nodes.has(k)) {
          nodes.add(k);
          queue.push(k);
        }
      }
    }
    return { nodes, edgeIds };
  }

  const down = bfs(start, outgoing, (_curr, e) => e.target);
  const up = bfs(start, incoming, (_curr, e) => e.source);

  const allNodes = new Set([...down.nodes, ...up.nodes]);
  const allEdges = new Set([...down.edgeIds, ...up.edgeIds]);
  return { start, nodes: allNodes, edges: allEdges, upstream: up, downstream: down };
}

export async function refreshGraph() {
  const container = document.getElementById("graphCanvas");
  const legend = document.getElementById("graphLegend");

  const data = await API.getGraph();
  if (!data.ok || !data.graph) {
    container.innerHTML = '<div class="graph-empty">Error loading graph data.</div>';
    return;
  }

  const nodes = data.graph.nodes.filter(n => n.nodeType === "thing" || n.nodeType === "concept");
  const edges = data.graph.edges;
  const rulesText = data.graph.rulesText || [];
  const actionsText = data.graph.actionsText || [];

  if (nodes.length === 0) {
    container.innerHTML = '<div class="graph-empty">No data to visualize.<br>Add facts in the Chat tab.</div>';
    legend.innerHTML = "";
    return;
  }

  legend.innerHTML = `
    <span class="legend-item">👤 thing</span>
    <span class="legend-item">🏷️ <i>concept</i></span>
    <span class="legend-item"><span class="legend-line solid"></span> relation</span>
    <span class="legend-item"><span class="legend-line dashed purple"></span> is a</span>
    <span class="legend-item"><span class="legend-line dashed orange"></span> implies</span>
  `;

  currentScale = 1;
  currentTranslate = { x: 0, y: 0 };
  renderGraph(container, nodes, edges, rulesText, actionsText);
}

function truncate(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

function renderGraph(container, nodeList, edges, rulesText, actionsText) {
  // Build node map
  const nodeMap = new Map(nodeList.map(n => [n.id, { 
    ...n, 
    deps: new Set(), 
    dependents: new Set(),
    level: 0,
    row: 0
  }]));
  
  const nodes = [...nodeMap.values()];
  const nodeElById = new Map();
  const nodeRectById = new Map();
  const nodeBaseStyleById = new Map(); // nodeId -> { stroke, strokeWidth, fill }
  let edgeRender = null; // built in redrawEdges()
  
  // Build dependency graph
  for (const e of edges) {
    const source = nodeMap.get(e.source);
    const target = nodeMap.get(e.target);
    if (!source || !target) continue;
    
    // Target depends on source (source should be left of target)
    target.deps.add(source.id);
    source.dependents.add(target.id);
  }
  
  // Topological sort for columns
  const visited = new Set();
  const levels = new Map();
  
  function getLevel(node) {
    if (levels.has(node.id)) return levels.get(node.id);
    if (visited.has(node.id)) return 0;
    visited.add(node.id);
    
    let maxDepLevel = -1;
    for (const depId of node.deps) {
      const dep = nodeMap.get(depId);
      if (dep) maxDepLevel = Math.max(maxDepLevel, getLevel(dep));
    }
    
    const level = maxDepLevel + 1;
    levels.set(node.id, level);
    return level;
  }
  
  for (const n of nodes) n.level = getLevel(n);
  
  // Group by level and sort within level to minimize edge crossings
  const columns = new Map();
  for (const n of nodes) {
    if (!columns.has(n.level)) columns.set(n.level, []);
    columns.get(n.level).push(n);
  }
  
  // Sort nodes within each column by their connections to previous column
  const sortedLevels = [...columns.keys()].sort((a, b) => a - b);
  
  for (let i = 1; i < sortedLevels.length; i++) {
    const level = sortedLevels[i];
    const prevLevel = sortedLevels[i - 1];
    const prevNodes = columns.get(prevLevel);
    const currNodes = columns.get(level);
    
    // Sort by average position of dependencies in previous column
    currNodes.sort((a, b) => {
      const aAvg = getAvgDepPosition(a, prevNodes);
      const bAvg = getAvgDepPosition(b, prevNodes);
      return aAvg - bAvg;
    });
  }
  
  function getAvgDepPosition(node, prevNodes) {
    let sum = 0, count = 0;
    for (const depId of node.deps) {
      const idx = prevNodes.findIndex(n => n.id === depId);
      if (idx >= 0) { sum += idx; count++; }
    }
    return count > 0 ? sum / count : 0;
  }
  
  // Assign positions
  const startX = 30;
  const startY = 30;
  let currentX = startX;
  
  for (const level of sortedLevels) {
    const colNodes = columns.get(level);
    let y = startY;
    
    for (let i = 0; i < colNodes.length; i++) {
      const n = colNodes[i];
      n.x = currentX;
      n.y = y;
      n.row = i;
      y += NODE_HEIGHT + ROW_GAP;
    }
    
    currentX += NODE_WIDTH + COL_GAP;
  }
  
  // Calculate canvas size
  const maxX = Math.max(...nodes.map(n => n.x + NODE_WIDTH)) + 50;
  const maxY = Math.max(...nodes.map(n => n.y + NODE_HEIGHT)) + 50;

  container.innerHTML = `
    <svg class="graph-svg" id="graphSvg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#666"/>
        </marker>
        <marker id="arrow-isa" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#9b59b6"/>
        </marker>
        <marker id="arrow-rule" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#e67e22"/>
        </marker>
      </defs>
      <g class="graph-viewport" id="graphViewport">
        <g class="edges"></g>
        <g class="nodes"></g>
      </g>
    </svg>
    <div class="graph-controls">
      <button class="graph-btn" id="zoomIn" title="Zoom In">+</button>
      <button class="graph-btn" id="zoomOut" title="Zoom Out">−</button>
      <div class="graph-btn-separator"></div>
      <button class="graph-btn" id="panLeft" title="Pan Left">◀</button>
      <button class="graph-btn" id="panRight" title="Pan Right">▶</button>
      <button class="graph-btn" id="panUp" title="Pan Up">▲</button>
      <button class="graph-btn" id="panDown" title="Pan Down">▼</button>
      <div class="graph-btn-separator"></div>
      <button class="graph-btn" id="panReset" title="Reset">⊙</button>
    </div>
  `;

  const svg = container.querySelector("svg");
  const viewport = document.getElementById("graphViewport");
  const edgesGroup = svg.querySelector(".edges");
  const nodesGroup = svg.querySelector(".nodes");
  
  // Create or reuse popup in body
  let popup = document.getElementById("nodePopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "nodePopup";
    popup.className = "node-popup";
    document.body.appendChild(popup);
  }
  popup.style.display = "none";
  
  // Set SVG size
  svg.setAttribute("width", container.clientWidth);
  svg.setAttribute("height", container.clientHeight);

  function applySelection() {
    if (!edgeRender) return;
    if (!selectedNodeId) {
      for (const [nodeId, el] of nodeElById) {
        el.style.opacity = "1";
        el.classList.remove("graph-node--selected");
        const rect = nodeRectById.get(nodeId);
        const base = nodeBaseStyleById.get(nodeId);
        if (rect && base) {
          rect.setAttribute("stroke", base.stroke);
          rect.setAttribute("stroke-width", base.strokeWidth);
          rect.setAttribute("fill", base.fill);
        }
      }
      for (let i = 0; i < edgeRender.paths.length; i += 1) {
        const path = edgeRender.paths[i];
        const hit = edgeRender.hits[i];
        const label = edgeRender.labels[i];
        if (path) {
          path.style.opacity = "";
          path.setAttribute("stroke-width", "1.5");
          path.classList.remove("graph-edge--selected");
        }
        if (hit) hit.style.opacity = "0";
        if (label) label.style.display = "none";
      }
      return;
    }

    const selection = computeConnectedSubgraph(selectedNodeId, edges);
    for (const [nodeId, el] of nodeElById) {
      const on = selection.nodes.has(nodeId);
      el.style.opacity = on ? "1" : "0.12";
      const rect = nodeRectById.get(nodeId);
      const base = nodeBaseStyleById.get(nodeId);
      if (rect && base) {
        if (nodeId === selection.start) {
          rect.setAttribute("stroke", "#111");
          rect.setAttribute("stroke-width", "3.5");
          rect.setAttribute("fill", "#fff4d6");
          el.classList.add("graph-node--selected");
        } else if (on) {
          rect.setAttribute("stroke", "#333");
          rect.setAttribute("stroke-width", "2.5");
          rect.setAttribute("fill", "white");
          el.classList.remove("graph-node--selected");
        } else {
          rect.setAttribute("stroke", base.stroke);
          rect.setAttribute("stroke-width", base.strokeWidth);
          rect.setAttribute("fill", base.fill);
          el.classList.remove("graph-node--selected");
        }
      }
    }

    for (let i = 0; i < edgeRender.paths.length; i += 1) {
      const path = edgeRender.paths[i];
      const hit = edgeRender.hits[i];
      const label = edgeRender.labels[i];
      const isSelectedEdge = selection.edges.has(i);
      if (path) {
        path.style.opacity = isSelectedEdge ? "1" : "0.06";
        path.setAttribute("stroke-width", isSelectedEdge ? "3" : "1.5");
        path.classList.toggle("graph-edge--selected", isSelectedEdge);
      }
      if (hit) hit.style.opacity = isSelectedEdge ? "0.15" : "0";
      if (label) label.style.display = isSelectedEdge ? "block" : "none";
    }
  }

  function updateTransform() {
    viewport.setAttribute("transform", 
      `translate(${currentTranslate.x}, ${currentTranslate.y}) scale(${currentScale})`);
  }

  // Draw edges
  function redrawEdges() {
    edgesGroup.innerHTML = "";
    edgeRender = { paths: [], hits: [], labels: [] };
    for (const e of edges) {
      const edgeIdx = edgeRender.paths.length;
      const source = nodeMap.get(e.source), target = nodeMap.get(e.target);
      if (!source || !target) {
        edgeRender.paths.push(null);
        edgeRender.hits.push(null);
        edgeRender.labels.push(null);
        continue;
      }

      const isIsa = e.edgeType === "isa";
      const isRule = e.edgeType === "rule";
      
      const x1 = source.x + NODE_WIDTH;
      const y1 = source.y + NODE_HEIGHT / 2;
      const x2 = target.x;
      const y2 = target.y + NODE_HEIGHT / 2;
      
      const midX = (x1 + x2) / 2;
      const pathD = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
      
      // Invisible wider path for easier clicking
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitArea.setAttribute("d", pathD);
      hitArea.setAttribute("stroke", "transparent");
      hitArea.setAttribute("stroke-width", "12");
      hitArea.setAttribute("fill", "none");
      hitArea.style.cursor = "pointer";
      hitArea.dataset.edgeId = String(edgeIdx);
      hitArea.addEventListener("click", (ev) => {
        ev.stopPropagation();
        popup.innerHTML = `<b>${e.label}</b>`;
        popup.style.display = "block";
        popup.style.left = `${ev.pageX + 5}px`;
        popup.style.top = `${ev.pageY - 25}px`;
      });
      edgesGroup.appendChild(hitArea);
      
      // Visible path
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathD);
      path.setAttribute("stroke", isIsa ? "#9b59b6" : isRule ? "#e67e22" : "#666");
      path.setAttribute("stroke-width", "1.5");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-dasharray", isIsa ? "4,2" : isRule ? "6,3" : "none");
      path.setAttribute("marker-end", isIsa ? "url(#arrow-isa)" : isRule ? "url(#arrow-rule)" : "url(#arrow)");
      path.setAttribute("pointer-events", "none");
      path.classList.add("graph-edge");
      path.dataset.edgeId = String(edgeIdx);
      edgesGroup.appendChild(path);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.classList.add("edge-label");
      label.dataset.edgeId = String(edgeIdx);
      label.setAttribute("x", String(midX));
      label.setAttribute("y", String((y1 + y2) / 2 - 6));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#111");
      label.setAttribute("stroke", "white");
      label.setAttribute("stroke-width", "3");
      label.setAttribute("paint-order", "stroke");
      label.textContent = String(e.label || "");
      label.style.display = "none";
      edgesGroup.appendChild(label);

      edgeRender.hits.push(hitArea);
      edgeRender.paths.push(path);
      edgeRender.labels.push(label);
    }
    applySelection();
  }

  redrawEdges();

  // Draw nodes
  for (const n of nodes) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    g.classList.add("graph-node");
    g.dataset.nodeId = idKey(n.id);

    const isConcept = n.nodeType === "concept";
    const icon = n.icon || (isConcept ? '🏷️' : '👤');
    const displayText = truncate(`${icon} ${n.name}`, 14);

    // Background rect
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", 0);
    rect.setAttribute("y", 0);
    rect.setAttribute("width", NODE_WIDTH);
    rect.setAttribute("height", NODE_HEIGHT);
    rect.setAttribute("rx", "4");
    rect.setAttribute("fill", "white");
    rect.setAttribute("stroke", n.color);
    rect.setAttribute("stroke-width", "1.5");
    g.appendChild(rect);
    nodeElById.set(idKey(n.id), g);
    nodeRectById.set(idKey(n.id), rect);
    nodeBaseStyleById.set(idKey(n.id), { stroke: n.color, strokeWidth: "1.5", fill: "white" });

    // Label (left aligned)
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", 8);
    label.setAttribute("y", NODE_HEIGHT / 2);
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("font-size", "11");
    label.setAttribute("fill", n.color);
    label.setAttribute("font-weight", "500");
    if (isConcept) label.setAttribute("font-style", "italic");
    label.setAttribute("pointer-events", "none");
    label.textContent = displayText;
    g.appendChild(label);

    // Info icon if concept and has rules/actions
    if (isConcept && (rulesText.length > 0 || actionsText.length > 0)) {
      const infoG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      infoG.classList.add("info-icon");
      infoG.setAttribute("transform", `translate(${NODE_WIDTH - 18}, 4)`);
      
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", 8);
      circle.setAttribute("cy", 10);
      circle.setAttribute("r", 8);
      circle.setAttribute("fill", "#f0f0f0");
      circle.setAttribute("stroke", "#999");
      infoG.appendChild(circle);
      
      const infoText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      infoText.setAttribute("x", 8);
      infoText.setAttribute("y", 10);
      infoText.setAttribute("text-anchor", "middle");
      infoText.setAttribute("dominant-baseline", "middle");
      infoText.setAttribute("font-size", "10");
      infoText.setAttribute("fill", "#666");
      infoText.setAttribute("font-weight", "bold");
      infoText.textContent = "i";
      infoG.appendChild(infoText);
      
      infoG.addEventListener("click", (ev) => {
        ev.stopPropagation();
        let html = `<b>${n.name}</b>`;
        if (rulesText.length > 0) {
          html += `<div class="popup-section"><b>📋 Rules:</b>` + rulesText.map(r => `<div>• ${r}</div>`).join('') + '</div>';
        }
        if (actionsText.length > 0) {
          html += `<div class="popup-section"><b>⚡ Actions:</b>` + actionsText.map(a => `<div>• ${a}</div>`).join('') + '</div>';
        }
        popup.innerHTML = html;
        popup.style.display = "block";
        popup.style.left = "0";
        popup.style.top = "0";
        // Measure and reposition if needed
        const btnRect = infoG.getBoundingClientRect();
        const popRect = popup.getBoundingClientRect();
        let left = btnRect.right + 8;
        if (left + popRect.width > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - popRect.width - 10);
        }
        popup.style.left = `${left}px`;
        popup.style.top = `${btnRect.top - 10}px`;
      });
      
      g.appendChild(infoG);
    }

    nodesGroup.appendChild(g);
  }

  // Selection + hide popup on click elsewhere
  svg.addEventListener("click", (ev) => {
    if (ev.target.closest(".graph-node") || ev.target.closest(".info-icon")) return;
    popup.style.display = "none";
    selectedNodeId = null;
    applySelection();
  });

  // Drag nodes
  let dragNode = null;
  let dragStart = { x: 0, y: 0 };
  let dragMoved = false;

  nodesGroup.addEventListener("mousedown", (e) => {
    if (e.target.closest(".info-icon")) return;
    const nodeEl = e.target.closest(".graph-node");
    if (!nodeEl) return;
    e.preventDefault();
    e.stopPropagation();
    
    const nodeId = nodeEl.dataset.nodeId;
    dragNode = nodeMap.get(nodeId);
    dragMoved = false;
    if (dragNode) {
      dragStart.x = e.clientX / currentScale - dragNode.x;
      dragStart.y = e.clientY / currentScale - dragNode.y;
      document.body.style.cursor = "grabbing";
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragNode) return;
    dragMoved = true;
    dragNode.x = e.clientX / currentScale - dragStart.x;
    dragNode.y = e.clientY / currentScale - dragStart.y;

    const nodeEl = nodesGroup.querySelector(`[data-node-id="${dragNode.id}"]`);
    if (nodeEl) nodeEl.setAttribute("transform", `translate(${dragNode.x}, ${dragNode.y})`);
    redrawEdges();
  });

  document.addEventListener("mouseup", () => {
    if (dragNode) {
      dragNode = null;
      document.body.style.cursor = "";
    }
  });

  nodesGroup.addEventListener("click", (e) => {
    if (e.target.closest(".info-icon")) return;
    const nodeEl = e.target.closest(".graph-node");
    if (!nodeEl) return;
    e.stopPropagation();
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    const nodeId = nodeEl.dataset.nodeId;
    selectedNodeId = selectedNodeId === nodeId ? null : nodeId;
    applySelection();
  });

  // Zoom controls
  const zoomStep = 0.2;
  const panStep = 50;
  
  document.getElementById("zoomIn")?.addEventListener("click", () => {
    currentScale = Math.min(currentScale + zoomStep, 3);
    updateTransform();
  });
  
  document.getElementById("zoomOut")?.addEventListener("click", () => {
    currentScale = Math.max(currentScale - zoomStep, 0.3);
    updateTransform();
  });
  
  document.getElementById("panLeft")?.addEventListener("click", () => {
    currentTranslate.x += panStep;
    updateTransform();
  });
  
  document.getElementById("panRight")?.addEventListener("click", () => {
    currentTranslate.x -= panStep;
    updateTransform();
  });
  
  document.getElementById("panUp")?.addEventListener("click", () => {
    currentTranslate.y += panStep;
    updateTransform();
  });
  
  document.getElementById("panDown")?.addEventListener("click", () => {
    currentTranslate.y -= panStep;
    updateTransform();
  });
  
  document.getElementById("panReset")?.addEventListener("click", () => {
    currentScale = 1;
    currentTranslate = { x: 0, y: 0 };
    updateTransform();
  });

  // Mouse wheel zoom
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
    currentScale = Math.max(0.3, Math.min(3, currentScale + delta));
    updateTransform();
  }, { passive: false });

  // Pan with drag on empty space
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  svg.addEventListener("mousedown", (e) => {
    if (e.target.closest(".graph-node")) return;
    isPanning = true;
    panStart.x = e.clientX - currentTranslate.x;
    panStart.y = e.clientY - currentTranslate.y;
    svg.style.cursor = "move";
  });

  svg.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    currentTranslate.x = e.clientX - panStart.x;
    currentTranslate.y = e.clientY - panStart.y;
    updateTransform();
  });

  svg.addEventListener("mouseup", () => { isPanning = false; svg.style.cursor = ""; });
  svg.addEventListener("mouseleave", () => { isPanning = false; svg.style.cursor = ""; });
}
