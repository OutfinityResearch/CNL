# DS28 - KB Explorer API

This document is a split-out part of DS17 (KB Explorer). DS17 remains the index.

## API Contract

### POST /api/session
Create new session.

### GET /api/session
Get session stats.

### GET /api/tree
Get the Knowledge Tree for the current session.

Key requirement: the server MUST provide an explicit `open` action for every node, so the client does not rely on fragile `id` heuristics.

### POST /api/command
Execute CNL.

### GET /api/overview
Get an overview report for an intermediate node (scoped summaries and clouds).

### GET /api/entity
Get entity details.

### GET /api/graph
Get graph data.

### POST /api/reset
Reset session.

### GET /api/examples
Get demo suite.

## References
- DS12: Session API
- DS17: KB Explorer index
- DS24: Theory consistency checks and issue taxonomy

