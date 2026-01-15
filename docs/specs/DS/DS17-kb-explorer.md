# DS17 - KB Explorer (Human-Friendly Knowledge Visualization)

## Summary
KB Explorer is a web-based tool that makes the CNL Knowledge Base understandable for non-technical users. It translates internal data structures into natural language descriptions, visual graphs, and interactive explorations.

**Design Principle:** Every screen answers "What do I know?" in plain language, not "What bits are set?"

## Terminology

### D0: Things vs Concepts
**Decision:** Use "Things" for instances and "concepts" for categories/types.

Based on analysis of CNL examples:
- **Things** (named individuals) = concrete instances/individuals: Socrates, John, Server_A, Robot_1, Package_1
- **concepts** (lowercase, italic) = abstract categories/types/classes: man, mortal, user, admin, hot, cold, water

This aligns with:
- Classical logic: individuals vs predicates
- OWL/RDF: instances vs classes
- Natural language: proper nouns vs common nouns

**Things vs Concepts (see DS03 for full specification):**

| Aspect | Things (Entities) | Concepts (Categories) |
|--------|-------------------|----------------------|
| Identity | Unique in space/time | Abstract, no identity |
| Examples | Socrates, Alice, Server_A, Robot_1 | man, user, robot, hot, water |
| Naming | Name-like tokens (often Capitalized / with digits / underscores) | lowercase (often hyphenated for compounds) |
| Compound | `my_car`, `Server_1` | `traffic-light`, `non-guest` |

**UI Display:**
- Tree: `👥 Things` and `🏷️ concepts`
- Graph: `👤` icon for things, `🏷️` icon for concepts
- Concepts shown in italic to distinguish from things

**Important:** Articles like `the` are not part of identity. The Explorer should not encourage Names like `the_robot`.
If a user needs a concrete individual, they should use a Name (for example `Robot_1`). `the robot` is a noun phrase
that describes a set, not a stable individual identifier (DS04).

**Symbolic concept constants:** Lowercase/hyphenated Name tokens (for example `pizza`, `flat-earth`) are treated as symbols and should be displayed
with concept styling (not as Things). In the Explorer tree they appear under `concepts → symbols`.

## Design Decisions

### D1: Technical View
**Decision:** Keep raw JSON/technical view ONLY when it reflects real session data.
- Show raw rule plans, KB indices only if they contain actual compiled data
- Hide empty or placeholder structures
- Label clearly as "Developer View" or "Debug Info"

### D2: Graph Visualization
**Decision:** Implement full interactive graph visualization for relationships.
- Entities as nodes, relationships as directed edges
- Categories as node colors/shapes
- Force-directed layout with zoom/pan
- Click to select, hover for details

### D3: Language
**Decision:** English only for all UI, messages, and CNL.
- No internationalization needed
- All natural language generation in English

### D4: Implementation Priority
**Decision:** Implement in order: A → B → C → D
1. Natural language responses in Chat
2. Knowledge Map (tree) restructured
3. Entity profile cards
4. Rule visualization with IF→THEN diagrams

---

## Architecture

### Server (`tools/explorer/server`)
- **Runtime:** Node.js (ES Modules)
- **Dependencies:** Core CNL modules only (no external npm)
- **State:** In-memory session map keyed by `sessionId`
- **Session Header:** `X-CNL-Session` required except for `/api/session`, `/api/examples`

### Client (`tools/explorer/client`)
- **Tech Stack:** Vanilla JS, HTML5, CSS Variables, SVG for graphs
- **Session:** Per-tab, created on page load, stored in memory only

---

## Component A: Natural Language Chat Responses

### Response Format
Every API response includes a `message` field with human-readable text.

For command-style responses (`/api/command`), the payload also includes a structured `result`.
When available, `result` includes a `proof` object as defined by DS18 (ProofTrace). The UI should render
the answer message and expose the proof steps and base premises to the user (collapsible panel or an
additional message block).

### Learn Responses
```
Input: "John is a user."
Response: "✓ Noted: John is now a user."

Input: "Every admin is a user."
Response: "✓ Rule added: If something is an admin, then it is a user."

Input: "John likes Pizza_1."
Response: "✓ Noted: John likes Pizza_1."
```

### Query Responses
```
Input: "Return every user."
Response: "Found 3 users: John, Alice, Bob"

Input: "Return every user." (no results)
Response: "No users found."
```

### Proof Responses
```
Input: "Verify that John is a user."
Response: "Yes, John is a user."

Input: "Verify that John is an admin."
Response: "No, John is not an admin."
```

When ProofTrace is present:
- Display the answer as usual.
- Display `proof.mode`, and render `proof.premises` before `proof.steps` (premise-first).
- For Derivation mode, prefer compact lines such as `Applied rule: ...` and `Therefore: ...` and avoid requiring RuleIDs in user-facing text.
- Proofs are rendered inline in the Chat response (as a compact text block). KB Explorer must not use a separate proof widget/panel.

### Explain Responses
```
Input: "Explain why John is a user."
Response: "John is a user because:
  • John is a user."

Input: "Explain why John is a user." (derived)
Response: "John is a user because:
  • John is an admin."
```

### Error Responses
```
Input: "Jhn is user"
Response: "I don't understand this. Try: 'John is a user.'
  Hint: Add 'a' or 'an' before the category name."
```

### Message Generation Rules
1. Use entity names without prefixes (`John` not `E:John`)
2. Use verb phrases naturally (`likes` not `P:likes|to`)
3. Passive predicates: `is assigned to` not `passive:assigned|to`
4. Pluralize correctly: "1 user" vs "3 users"
5. List up to 5 items, then "and N more"

---

## Component B: Knowledge Map (Tree View)

### Structure
```
📚 Knowledge Base
├── 👥 Things (12)
│   ├── John — user, admin
│   ├── Alice — user
│   ├── Pizza_1 — food
│   └── ... (9 more)
├── 🏷️ concepts (5)
│   ├── user — 3 members
│   ├── admin — 1 member
│   ├── food — 2 members
│   └── ...
├── 🔗 relationships (3)           <-- Grouped by first relevant concept
│   ├── likes (4 connections)
│   │   ├── user (3)
│   │   │   ├── John (2)
│   │   │   │   ├── Pizza_1
│   │   │   │   └── Coffee_1
│   │   │   └── Alice (1)
│   │   │       └── Tea_1
│   ├── manages (2)
│   │   ├── admin (2)
│   │   │   └── John (2)
│   │   │       └── Alice
│   └── assigned to (1)
│       ├── truck (1)
│       │   └── Truck_1 (1)
│       │       └── Depot_A
├── 📋 rules (2)                   <-- Grouped by first relevant concept
│   ├── admin (1 rule)
│   │   └── If admin then user
│   └── manages (1 rule)
│       └── If manages then admin
├── ⚡ actions (1)
│   └── deliver package
└── ⚠️ issues (3)                  <-- Must be LAST
    ├── ❌ Errors (1)
    │   └── TypeBinaryPredicateConflict (1)
    │       └── year (1)
    │           └── Dictionary key 'year' is declared both as a type and as a binary predicate.
    └── ⚠️ Warnings (2)
        └── DuplicateRule (2)
            └── duplicate-rules (2)
                ├── Rule #0 has 2 duplicates
                └── Rule #3 has 2 duplicates
```

### Node Display Rules
1. **Top-level folder order:** `Things`, `concepts`, `relationships`, `rules`, `transitions`, `actions`, **issues (last)**.
2. **Warnings:**
   - The tree uses the label `⚠️ issues` and includes both errors and warnings.
   - Grouped by `severity` → `kind` → `key` (concept/term).
   - Leaf: specific issue text + kind + severity + raw JSON.
   - Source of truth: issues come from the active session state (DS12/DS24):
     - `session.state.dictionary.warnings` (compiler + theory diagnostics)
     - rule store duplicate reporting (`DuplicateRule`)
   - If a loaded bundle applies directive-based load-time renames (DS25), the session must surface an issue indicating a rewrite occurred (`LoadTimeRenameApplied`).
3. **Things (Entities):** Show name + top 2 categories; leaf shows full inbound/outbound relations + raw JSON.
4. **Categories:** Show name + member count; leaf shows full member list + raw JSON.
5. **Relationships (Binary predicates):**
   - Level 1: predicate name + total connection count.
   - Level 2: **first relevant concept** for the connection set (currently: subject's first category; fallback: `(uncategorized)`).
   - Level 3: subject (Thing) + count.
   - Level 4: object leaf; clicking shows the specific fact + raw JSON (ids, formatted sentence, existence check).
6. **Rules (Deductive):**
   - Level 1: **first relevant concept** in the rule's condition (deterministic: smallest unary dependency id; else smallest predicate dependency id; else `general`).
   - Level 2: rule leaf; clicking shows IF/THEN + raw JSON (rule plan).
7. **Actions:** Action name; leaf shows preconditions/effects + raw JSON.

### Expand/Collapse
- Folders have a `+`/`−` toggle control.
- Clicking a node selects it and renders a report/details view in the details panel.
- Default expansion is data-dependent (for example, Things may auto-collapse if too large).

### Empty State
```
📚 Knowledge Base
└── (empty) — Start by adding facts in the Chat tab
```

---

## Component C: Entity Profile Cards

### Layout
```
┌─────────────────────────────────────────────────────┐
│ 👤 John                                    ID: 0    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ IS A                                                │
│ ┌─────────┐ ┌─────────┐                            │
│ │  user   │ │  admin  │                            │
│ │ stated  │ │ stated  │                            │
│ └─────────┘ └─────────┘                            │
│                                                     │
│ RELATIONSHIPS                                       │
│ ┌───────────────────────────────────────────────┐  │
│ │ John ──likes──→ Pizza_1                       │  │
│ │ John ──likes──→ Coffee_1                      │  │
│ │ John ──manages──→ Alice                       │  │
│ │ Bob ──reports to──→ John                      │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ATTRIBUTES                                          │
│ • age: 30                                          │
│ • status: active                                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ▶ Developer View                                   │
│   { "denseId": 0, "conceptId": "E:John", ... }     │
└─────────────────────────────────────────────────────┘
```

### Sections

#### IS A (Categories)
- Show all unary predicates the entity belongs to
- Badge color: green for stated, blue for derived
- Click badge to see category members

#### RELATIONSHIPS
- Group by direction: outgoing first, then incoming
- Format: `Subject ──verb──→ Object`
- Incoming shown as: `Other ──verb──→ This`
- Click entity name to navigate

#### ATTRIBUTES
- Show name: value pairs
- Numeric values formatted (thousands separator)
- Entity-valued attributes as clickable links

#### Developer View (Collapsible)
- Only show if session has real data
- Raw JSON of internal representation
- Dense IDs, concept keys, bitset info

### Category Card
```
┌─────────────────────────────────────────────────────┐
│ 🏷️ user                                   ID: 0    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ MEMBERS (3)                                         │
│ • John                                             │
│ • Alice                                            │
│ • Bob                                              │
│                                                     │
│ SUPERTYPES                                          │
│ (none)                                             │
│                                                     │
│ SUBTYPES                                            │
│ • admin (1 member)                                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ▶ Developer View                                   │
└─────────────────────────────────────────────────────┘
```

### Relationship Card
```
┌─────────────────────────────────────────────────────┐
│ 🔗 likes                                  ID: 0    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ CONNECTIONS (4)                                     │
│ • John likes Pizza_1                               │
│ • John likes Coffee_1                              │
│ • Alice likes Tea_1                                │
│ • Bob likes Pizza_1                                │
│                                                     │
│ STATISTICS                                          │
│ • Subjects: 3 (John, Alice, Bob)                   │
│ • Objects: 3 (Pizza_1, Coffee_1, Tea_1)            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ▶ Developer View                                   │
└─────────────────────────────────────────────────────┘
```

---

## Component D: Rule Visualization

### Rule Card with Flow Diagram
```
┌─────────────────────────────────────────────────────┐
│ 📋 Rule #0                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ NATURAL LANGUAGE                                    │
│ "If something is an admin, then it is a user."     │
│                                                     │
│ LOGIC FLOW                                          │
│                                                     │
│   ┌─────────────────────────┐                      │
│   │         IF              │                      │
│   │  ┌─────────────────┐    │                      │
│   │  │ ?X is an admin  │    │                      │
│   │  └─────────────────┘    │                      │
│   └───────────┬─────────────┘                      │
│               │                                     │
│               ▼                                     │
│   ┌─────────────────────────┐                      │
│   │        THEN             │                      │
│   │  ┌─────────────────┐    │                      │
│   │  │ ?X is a user    │    │                      │
│   │  └─────────────────┘    │                      │
│   └─────────────────────────┘                      │
│                                                     │
│ APPLIED TO                                          │
│ • John (derived: John is a user)                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ▶ Developer View                                   │
│   { body: { op: "UnarySet", ... }, head: ... }     │
└─────────────────────────────────────────────────────┘
```

### Complex Rule (Multiple Conditions)
```
│ LOGIC FLOW                                          │
│                                                     │
│   ┌─────────────────────────────────┐              │
│   │              IF                 │              │
│   │  ┌───────────────────────────┐  │              │
│   │  │ ?X is a driver            │  │              │
│   │  └─────────────┬─────────────┘  │              │
│   │                │ AND            │              │
│   │  ┌─────────────▼─────────────┐  │              │
│   │  │ ?X is assigned to ?Y      │  │              │
│   │  └─────────────┬─────────────┘  │              │
│   │                │ AND            │              │
│   │  ┌─────────────▼─────────────┐  │              │
│   │  │ ?Y is a route             │  │              │
│   │  └───────────────────────────┘  │              │
│   └───────────────┬─────────────────┘              │
│                   ▼                                 │
│   ┌─────────────────────────────────┐              │
│   │             THEN                │              │
│   │  ┌───────────────────────────┐  │              │
│   │  │ ?X is active              │  │              │
│   │  └───────────────────────────┘  │              │
│   └─────────────────────────────────┘              │
```

### Condition Description Rules
| Plan Op | Natural Language |
|---------|------------------|
| `UnarySet(U)` | `?X is a U` |
| `Intersect([A,B])` | `A` AND `B` |
| `Union([A,B])` | `A` OR `B` |
| `Image(pred, set)` | `?X verb ?Y` where `?Y` matches set |
| `Preimage(pred, set)` | `?Y verb ?X` where `?Y` matches set |

### Effect Description Rules
| Head Kind | Natural Language |
|-----------|------------------|
| `UnaryEmit(U)` | `?X is a U` |
| `BinaryEmit(P)` | `?X verb ?Y` |
| `AttrSet(A, V)` | `?X has A of V` |

---

## Component E: Graph Visualization (MANDATORY)

### Overview
Interactive force-directed graph that mirrors the Knowledge Tree structure. All elements visible in the tree MUST be represented in the graph.

### Required Node Types

The graph MUST display ALL of these node types (matching the tree):

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

1. **Drag nodes** - User MUST be able to drag any node to reposition it
2. **Pan canvas** - Drag on empty space to pan
3. **Zoom** - Mouse wheel or +/- buttons
4. **Reset view** - Button to reset zoom/pan

### Node Rendering

Each node displays:
- Icon (emoji based on type)
- Name
- Rounded rectangle background with colored border
- Concepts shown in italic

### Edge Rendering

- Arrows point from source to target
- Labels rotated to follow edge direction
- Bidirectional edges curve to avoid overlap
- "is a" edges connect things to concepts

### Legend (in toolbar)

```
👤 thing | 🏷️ concept | 📋 rule | ⚡ action | ─── relation | - - - is a
```

### Force Layout

- Repulsion between all nodes
- Attraction along edges
- Auto-fit to viewport on load
- Nodes without edges float to periphery
- Scroll wheel: Zoom in/out
- Double-click: Reset view
- Zoom range: 0.25x to 4x

#### Node Selection
- Click node: select and highlight the connected subgraph (both upstream and downstream reachability).
- Selected node: thicker border + highlighted background.
- Reachable nodes: highlighted; unreachable nodes: heavily dimmed.
- Reachable edges: thicker + show edge labels; unreachable edges: heavily dimmed.
- Click empty space: clear selection.

#### Node Dragging
- Drag node: Reposition manually
- Release: Node stays in place (pinned)
- Double-click pinned node: Unpin, return to physics

#### Hover
- Hover node: Show tooltip with categories
- Hover edge: Show relationship label
- Tooltip format: "John (user, admin)"

#### Context Menu (Right-click)
```
┌─────────────────────┐
│ View Details        │
│ Focus on This       │
│ Hide This Node      │
│ Show Only Connected │
│ ─────────────────── │
│ Pin Position        │
│ Unpin Position      │
└─────────────────────┘
```

### Layout Algorithm

#### Force-Directed (Default)
```javascript
const simulation = {
  forces: {
    charge: -300,      // Repulsion between nodes
    link: {
      distance: 100,   // Ideal edge length
      strength: 0.5    // Edge stiffness
    },
    center: true,      // Pull toward center
    collision: 35      // Prevent overlap
  },
  alpha: 1,            // Initial energy
  alphaDecay: 0.02,    // Cooling rate
  velocityDecay: 0.4   // Friction
};
```

#### Hierarchical (Optional)
For rule-derived relationships, option to show hierarchy:
- Root nodes at top
- Derived nodes below
- Levels based on derivation depth

### Filtering

#### By Category
```
┌─────────────────────────────┐
│ Show Categories:            │
│ ☑ user                      │
│ ☑ admin                     │
│ ☐ food (hide)               │
│ ☑ Place                     │
└─────────────────────────────┘
```

#### By Relationship
```
┌─────────────────────────────┐
│ Show Relationships:         │
│ ☑ likes                     │
│ ☑ manages                   │
│ ☐ assigned to (hide)        │
└─────────────────────────────┘
```

#### Search
- Text input filters visible nodes
- Matches entity names
- Non-matching nodes dimmed

### Graph Data Structure

#### API: GET /api/graph
```json
{
  "ok": true,
  "graph": {
    "nodes": [
      {
        "id": 0,
        "name": "John",
        "categories": ["user", "admin"],
        "primaryCategory": "user",
        "connectionCount": 4
      },
      {
        "id": 1,
        "name": "Alice",
        "categories": ["user"],
        "primaryCategory": "user",
        "connectionCount": 2
      },
      {
        "id": 2,
        "name": "Pizza_1",
        "categories": ["food"],
        "primaryCategory": "food",
        "connectionCount": 2
      }
    ],
    "edges": [
      {
        "id": "e0",
        "source": 0,
        "target": 2,
        "predicate": "likes",
        "label": "likes"
      },
      {
        "id": "e1",
        "source": 0,
        "target": 1,
        "predicate": "manages",
        "label": "manages"
      }
    ],
    "categories": [
      { "name": "user", "color": "#3498db", "count": 2 },
      { "name": "food", "color": "#e67e22", "count": 1 }
    ]
  }
}
```

### SVG Structure
```html
<svg class="graph-canvas" viewBox="0 0 800 600">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
            refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
    </marker>
  </defs>
  
  <g class="edges">
    <g class="edge" data-id="e0">
      <path d="M100,100 Q150,50 200,100" 
            stroke="#666" fill="none" marker-end="url(#arrowhead)"/>
      <text class="edge-label" x="150" y="45">likes</text>
    </g>
  </g>
  
  <g class="nodes">
    <g class="node" data-id="0" transform="translate(100,100)">
      <circle r="25" fill="#3498db" stroke="#2980b9" stroke-width="2"/>
      <text dy="4" text-anchor="middle" fill="white">John</text>
    </g>
  </g>
</svg>
```

### Performance Considerations
- Max nodes before warning: 100
- Max edges before simplification: 500
- Large graphs: Show "simplified view" with clustering
- WebGL fallback for >200 nodes (future)

### Empty State
```
┌─────────────────────────────────────────┐
│                                         │
│     No relationships to visualize.      │
│                                         │
│     Add facts like:                     │
│     "John likes Pizza_1."               │
│     "Alice manages Bob."                │
│                                         │
└─────────────────────────────────────────┘
```

---

## Component F: Intermediate Node Interaction (Scoped Summaries)

### Problem
The tree view contains intermediate grouping nodes (e.g., a "User" folder inside Warnings, or a "Likes" folder inside Relationships). Clicking these nodes currently does nothing or shows generic info. Users need to see a **comprehensive summary report** of the subtree they just clicked.

### Solution: Scoped Overviews
Clicking any non-leaf node MUST render a "Report View" in the details panel.

**Requirements:**
1.  **Contextual:** The report lists only items within that specific branch.
2.  **Copy-Paste Friendly:** Information should be presented in text/tables that are easy to select and copy.
3.  **Aggregated Stats:** Show counts and specific details for the group.
4.  **Concept Cloud:** The report SHOULD render a compact "concept cloud" (colored bubbles sized by connectivity/frequency). Clicking a bubble reveals and selects the corresponding node in the Knowledge Tree and opens its details.

**Applies to:** all non-leaf nodes, including top-level folders (`Things`, `concepts`, `relationships`, `rules`, `warnings`, etc.). In these views, the cloud is the primary visualization; list/table views may be kept as a collapsible "List View" for copy/paste.

### Scoped View Types

#### 1. Warning Group (by Concept)
**Clicking:** `issues > ⚠️ Warnings > AmbiguousPredicateArity > user`
**Displays:**
- **Title:** "Issues regarding 'user'"
- **List:** All error messages associated with this concept.
- **Reasons:** Detailed explanation for each error.
- **Suggested Fixes:** (If available)
- **Developer View:** raw JSON for all warning items in this group.

#### 2. Predicate Group
**Clicking:** `Relationships > likes`
**Displays:**
- **Title:** "Predicate: likes"
- **Stats:** Total connections, unique subjects, unique objects.
- **Table:** Full list of `Subject -> Object` pairs.
- **Definition:** Domain/Range info (if declared).
- **Developer View:** raw JSON (ids and connection list).

#### 3. Predicate Category Group
**Clicking:** `Relationships > likes > user`
**Displays:**
- **Title:** "likes — user"
- **Stats:** Total connections inside this category group.
- **Table:** Full list of `Subject -> Object` pairs within the group.
- **Developer View:** raw JSON (ids and filtered connections).

#### 4. Subject Group
**Clicking:** `Relationships > likes > user > John`
**Displays:**
- **Title:** "John likes..."
- **List:** All objects John likes.
- **Provenance:** Is this stated or derived?
- **Developer View:** raw JSON (ids and target list).

#### 5. Relationship Fact Leaf
**Clicking:** `Relationships > likes > user > John > Pizza_1`
**Displays:**
- **Title:** "Relationship Fact"
- **Sentence:** "John likes Pizza_1"
- **Existence check:** whether the fact is currently present in the compiled KB.
- **Developer View:** raw JSON (predicate id, subject id, object id, formatted sentence).

#### 6. Rule Trigger Group
**Clicking:** `Rules > admin`
**Displays:**
- **Title:** "Rules triggered by 'admin'"
- **List:** All rules where 'admin' is the primary condition.
- **Natural Language:** The full text of these rules.
- **Developer View:** raw JSON (rule ids in the group).

---

## Component G: Rich Leaf Details

Every leaf node in the tree must provide complete, relevant context.

### 1. Entity Leaf
- **Current:** Basic properties.
- **Improved:**
    - **Raw Key:** `E:John`
    - **Provenance:** Source file or "User Input".
    - **Full Relations:** Both incoming and outgoing, clickable.
    - **Rules Affected:** Which rules apply to this entity? (e.g. "Matches Rule #1").
    - **Developer View:** a raw JSON dump of the underlying session structures relevant to this entity (conceptual ids, category ids, relation ids).

### 2. Rule Leaf
- **Current:** Basic IF/THEN.
- **Improved:**
    - **Copyable Text:** The exact CNL text to recreate the rule.
    - **Matches:** List of entities currently satisfying the condition.
    - **Derived Facts:** List of facts generated *specifically* by this rule.
    - **Developer View:** raw JSON dump of the rule plan (including dependencies/sets).

### 3. Relationship Fact Leaf
- **Improved:**
    - **Sentence:** "John likes Pizza_1"
    - **IDs:** predicate id, subject id, object id
    - **Existence check:** whether the fact is currently present in the compiled KB
    - **Developer View:** raw JSON dump of the connection payload.

### 4. Warning Leaf
- **Improved:**
    - **Concept/Term:** what the warning is about
    - **Kind + Severity:** classification
    - **Message:** what is wrong
    - **Developer View:** raw JSON dump of the warning object.

---

## API Contract

### POST /api/session
Create new session.

**Response:**
```json
{
  "ok": true,
  "sessionId": "uuid",
  "summary": { "warnings": 0, "things": 0, "categories": 0, "relationships": 0, "rules": 0 },
  "message": "Session ready. Start adding facts."
}
```

### GET /api/session
Get session stats.

**Response:**
```json
{
  "ok": true,
  "sessionId": "uuid",
  "summary": { "warnings": 3, "things": 12, "categories": 5, "relationships": 3, "rules": 2 },
  "message": "12 things known across 5 categories"
}
```

### GET /api/tree
Get the Knowledge Tree for the current session.

**Key requirement:** the server MUST provide an explicit `open` action for every node, so the client does not rely on fragile `id` heuristics.

**Node shape (minimal):**
```json
{
  "id": "p-0-c-12-s-3-o-9",
  "text": "Pizza_1",
  "icon": "tag",
  "tooltip": "optional",
  "expanded": false,
  "children": [],
  "open": { "type": "overview", "kind": "scoped", "id": "p-0-c-12-s-3-o-9" }
}
```

**open actions:**
- `{ "type": "overview", "kind": "<overviewKind>", "id": "<optionalScopedId>" }` → `GET /api/overview?kind=<overviewKind>&id=<optionalScopedId>`
- `{ "type": "entity", "entityType": "<entityKind>", "id": <denseId> }` → `GET /api/entity?type=<entityKind>&id=<denseId>`

### POST /api/command
Execute CNL.

**Request:** `{ "text": "John is a user." }`

**Response (learn):**
```json
{
  "ok": true,
  "mode": "learn",
  "message": "✓ Noted: John is now a user.",
  "changes": { "newEntities": ["John"], "newCategories": ["user"], "newFacts": 1 },
  "summary": { "warnings": 0, "things": 1, "categories": 1, "relationships": 0, "rules": 0 }
}
```

**Response (query):**
```json
{
  "ok": true,
  "mode": "command",
  "result": { "kind": "QueryResult", "items": [{"name":"John","id":0}], "count": 1 },
  "message": "Found 1 user: John"
}
```

### GET /api/knowledge
Get knowledge tree.

**Response:**
```json
{
  "ok": true,
  "knowledge": {
    "warnings": [
       {
         "concept": "user",
         "count": 2,
         "issues": [
            { "message": "declared as both type and attribute", "reason": "ambiguous usage" },
            { "message": "usage without determiner", "reason": "syntax rule violation" }
         ]
       }
    ],
    "entities": [
      { "id": 0, "name": "John", "categories": ["user","admin"], "summary": "John is a user and admin" }
    ],
    "categories": [
      { "id": 0, "name": "user", "memberCount": 3, "members": ["John","Alice","Bob"] }
    ],
    "relationships": [
      { 
        "name": "likes", 
        "count": 4, 
        "subjects": [
           { "name": "John", "count": 2, "objects": ["Pizza_1", "Coffee_1"] },
           { "name": "Alice", "count": 1, "objects": ["Tea_1"] }
        ]
      }
    ],
    "rules": [
      { 
        "trigger": "admin", 
        "count": 1, 
        "items": [
           { "id": 0, "summary": "If admin then user" }
        ]
      }
    ],
    "actions": [
      { "id": 0, "name": "deliver package" }
    ]
  }
}
```

### GET /api/entity?name=John
Get entity details.

**Response:**
```json
{
  "ok": true,
  "entity": {
    "name": "John", "id": 0,
    "categories": [{ "name": "user", "source": "stated" }],
    "outgoing": [{ "verb": "likes", "object": "Pizza_1" }],
    "incoming": [{ "verb": "managed by", "subject": "Boss" }],
    "attributes": [{ "name": "age", "value": 30 }],
    "raw": { "denseId": 0, "conceptKey": "E:John" }
  }
}
```

### GET /api/graph
Get graph data.

**Response:** (see Graph Data Structure above)

### GET /api/rule?id=0
Get rule details.

**Response:**
```json
{
  "ok": true,
  "rule": {
    "id": 0,
    "natural": "If something is an admin, then it is a user.",
    "condition": { "text": "?X is an admin", "plan": {...} },
    "effect": { "text": "?X is a user", "head": {...} },
    "appliedTo": [{ "entity": "John", "derived": "John is a user" }],
    "raw": { "kind": "RulePlan", "body": {...}, "head": {...} }
  }
}
```

### POST /api/reset
Reset session.

**Response:**
```json
{ "ok": true, "message": "Knowledge cleared. Ready for new facts." }
```

### GET /api/examples
Get demo suite.

---

## Natural Language Generation

### Entity Key Formatting
```javascript
function formatEntityName(key) {
  if (!key) return '(unknown)';
  if (key.startsWith('E:')) return key.slice(2);
  if (key.startsWith('L:')) return key.slice(2);
  return key;
}
```

### Predicate Formatting
```javascript
function formatPredicate(key) {
  if (!key) return '(unknown)';
  let clean = key.replace(/^P:/, '');
  if (clean.startsWith('passive:')) {
    // "passive:assigned|to" → "is assigned to"
    const match = clean.match(/passive:(\w+)\|(\w+)/);
    if (match) return `is ${match[1]} ${match[2]}`;
  }
  // "likes|to" → "likes"
  // "aux:can|access" → "can access"
  return clean.split('|').join(' ').replace('aux:', '');
}
```

### Category Formatting
```javascript
function formatCategory(key) {
  if (!key) return '(unknown)';
  return key.replace(/^U:/, '');
}
```

### Pluralization
```javascript
function pluralize(word, count) {
  if (count === 1) return word;
  // Simple rules
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch')) 
    return word + 'es';
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) 
    return word.slice(0,-1) + 'ies';
  return word + 's';
}
```

### List Formatting
```javascript
function formatList(items, max = 5) {
  if (items.length === 0) return '(none)';
  if (items.length === 1) return items[0];
  if (items.length <= max) {
    return items.slice(0,-1).join(', ') + ' and ' + items[items.length-1];
  }
  return items.slice(0, max).join(', ') + ` and ${items.length - max} more`;
}
// ["John"] → "John"
// ["John", "Alice"] → "John and Alice"
// ["John", "Alice", "Bob"] → "John, Alice and Bob"
// [6 items] → "John, Alice, Bob, Carol, Dave and 1 more"
```

---

## Error Messages

### User-Friendly Error Format
```json
{
  "ok": false,
  "error": {
    "message": "I don't understand 'Jhn is user'.",
    "hint": "Try: 'John is a user.' — add 'a' before the category.",
    "code": "SYN001",
    "position": { "line": 1, "column": 8 }
  }
}
```

### Error Message Templates
| Code | Message Template |
|------|------------------|
| SYN001 | "Missing 'a' or 'an' before '{word}'." |
| SYN015 | "Expected ':' after 'Rule' or 'Command'." |
| CMP007 | "I need specific names, not general descriptions." |
| CMP018 | "Use 'every' or 'all' for rules about categories." |

---

## Visual Design

### Colors
- Entity (default): #3498db (blue)
- Category badge: #27ae60 (green)
- Relationship: #e67e22 (orange)
- Rule: #9b59b6 (purple)
- Action: #1abc9c (teal)
- Error: #e74c3c (red)
- Success: #2ecc71 (green)
- Muted: #95a5a6 (gray)

### Icons
- 👤 Entity
- 🏷️ Category
- 🔗 Relationship
- 📋 Rule
- ⚡ Action
- ✓ Success
- ✗ Error
- 💡 Hint

---

## References
- DS03: Syntax
- DS04: Semantics
- DS07: Error handling
- DS12: Session API
- DS24: Theory consistency checks and issue taxonomy
