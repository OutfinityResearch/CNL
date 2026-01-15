# DS29 - KB Explorer Graph Visualization

This document is a split-out part of DS17 (KB Explorer). DS17 remains the index.

## Component E: Graph Visualization (MANDATORY)

### Overview
Interactive force-directed graph that mirrors the Knowledge Tree structure. All elements visible in the tree MUST be represented in the graph.

### Required Node Types
| Type | Icon | Color | Style |
|------|------|-------|-------|
| thing | 👤 | #3498db (blue) | normal text |
| concept | 🏷️ | #9b59b6 (purple) | italic text |
| rule | 📋 | #e67e22 (orange) | normal text |
| action | ⚡ | #e74c3c (red) | normal text |

### Required Edge Types
| Type | Style | Color | Label |
|------|-------|-------|-------|
| relation | solid line + arrow | #666 | predicate name |
| is a | dashed line + arrow | #9b59b6 | "is a" |

### Required Interactions
1. Drag nodes
2. Pan canvas
3. Zoom
4. Reset view

### Node Selection
- Click node: select and highlight the connected subgraph (both upstream and downstream reachability).
- Reachable nodes/edges highlighted; everything else dimmed.

## References
- DS17: KB Explorer index
- DS30: Knowledge Tree (node set must match the tree)

