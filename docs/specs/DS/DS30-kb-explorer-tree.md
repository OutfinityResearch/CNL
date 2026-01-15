# DS30 - KB Explorer Knowledge Tree (Grouping, Clouds, Details)

This document is a split-out part of DS17 (KB Explorer). DS17 remains the index.

## Component B: Knowledge Map (Tree View)

### Node Display Rules
1. Top-level order: `Things`, `concepts`, `relationships`, `rules`, `transitions`, `actions`, `issues (last)`.
2. `issues` grouped by `severity` → `kind` → `key` (DS24).
3. `relationships` and `rules` grouped by first relevant concept.

## Component F: Intermediate Node Interaction (Scoped Summaries)

Clicking any non-leaf node MUST render a Report View in the details panel:
- aggregated stats
- copy/paste friendly table/list
- concept cloud (primary visualization)

## Component G: Rich Leaf Details

All leaf nodes must expose:
- natural language summary
- raw JSON from the session representation
- source information (file/line when available)

## References
- DS17: KB Explorer index
- DS24: Issue taxonomy + grouping rules

