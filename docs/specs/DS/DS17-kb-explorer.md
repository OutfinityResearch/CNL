# DS17 - KB Explorer (Client-Server Tool)

## Summary
KB Explorer is a web-based visualization tool for the CNL-PL runtime. It allows developers to interactively run CNL commands, visualize the state of the Knowledge Base (Bitsets, Relations, Entities), and inspect the justification traces for derived facts.

It follows a Client-Server architecture where the server hosts a `CNLSession` and the client acts as a REPL and Inspector.

## Architecture

### Server (`tools/explorer/server`)
- **Runtime:** Node.js (ES Modules).
- **Dependencies:** Core CNL modules (`src/session/`, `src/compiler/`, `src/kb/`). No external npm dependencies (uses native `node:http`).
- **State:** Maintains a persistent `CNLSession` instance in memory.
- **API Endpoints:**
  - `POST /api/command`: Executes a CNL string (learn, query, verify) and returns results + side effects.
  - `GET /api/session`: Returns KB statistics (entity count, relation count).
  - `GET /api/entities`: Returns a paginated/filtered list of entities (ID -> String).
  - `GET /api/relations`: Returns the structure of the RelationMatrix.
  - `POST /api/reset`: Clears the session.

### Client (`tools/explorer/client`)
- **Tech Stack:** Vanilla JS, HTML5, CSS (Variables-based).
- **Components:**
  - **Chat/REPL:** A conversational interface for sending CNL commands.
  - **KB Tree View:** A hierarchical view of Concepts (Entities, Predicates) and their members.
  - **Details Pane:** Inspects specific entities (showing attributes and relations).
- **Design:** Mimics the "AGISystem2 KBExplorer" layout but adapted for the CNL-PL Bitset architecture.

## API Contract

### Execute Command
```http
POST /api/command
Content-Type: application/json

{ "text": "Every user is active." }
```

**Response:**
```json
{
  "ok": true,
  "output": "Learned 1 rule.",
  "facts": 5, // Total facts in KB
  "lastTrace": { ... } // Optional provenance
}
```

### Inspect Entity
```http
GET /api/entity?id=42
```

**Response:**
```json
{
  "id": 42,
  "text": "John",
  "type": "Entity",
  "relations": {
    "is-a": ["User", "Admin"],
    "accesses": ["File1", "File2"]
  },
  "attributes": {
    "score": 99
  }
}
```

## Adaptation from AGI Explorer
- Removed: HDC Vectors, URC Audit, Polynomial Terms.
- Added: Bitset inspection, RulePlan visualization.
- Retained: Session lifecycle, Chat UI, Split-pane layout.
