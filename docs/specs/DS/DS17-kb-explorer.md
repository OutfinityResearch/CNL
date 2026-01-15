# DS17 - KB Explorer (Human-Friendly Knowledge Visualization) — Index

## Summary
KB Explorer is a web-based tool that makes the CNL Knowledge Base understandable for non-technical users.
It translates internal data structures into natural language descriptions, interactive exploration views, and visual graphs.

**Design Principle:** every screen answers "What do I know?" in plain language, not "What bits are set?"

## Terminology (canonical)
- **Things**: named individuals (instances) such as `Socrates`, `Server_A`, `Robot_1`.
- **concepts**: abstract categories/types such as `man`, `mortal`, `user`, `hot`.
- Articles like `the` are not part of identity: `the robot` is a noun phrase (a set description), not a stable Thing identifier.

## Architecture (high-level)
- Server: `tools/explorer/server/` (Node.js, in-memory sessions keyed by `sessionId`)
- Client: `tools/explorer/client/` (vanilla JS, SVG graphs)

## Split Documents
DS17 is an index. Detailed specs are split into:
- DS27: KB Explorer UI (Chat, Cards, Rules, NLG, Design)
- DS28: KB Explorer API
- DS29: KB Explorer Graph Visualization
- DS30: KB Explorer Knowledge Tree (Grouping, Clouds, Details)

## References
- DS03: Syntax
- DS04: Semantics
- DS07: Error handling
- DS12: Session API
- DS18: Proof traces
- DS24: Theory consistency checks and issue taxonomy
