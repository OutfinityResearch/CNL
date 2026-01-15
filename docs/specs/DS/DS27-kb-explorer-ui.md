# DS27 - KB Explorer UI (Chat, Cards, Rules, NLG, Design)

This document is a split-out part of DS17 (KB Explorer). DS17 remains the index.

## Component A: Natural Language Chat Responses

### Response Format
Every API response includes a `message` field with human-readable text.

For command-style responses (`/api/command`), the payload also includes a structured `result`.
When available, `result` includes a `proof` object as defined by DS18 (ProofTrace). The UI should render
the answer message and expose the proof steps and base premises to the user.

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
```

## Component C: Entity Profile Cards

### Layout
```
┌─────────────────────────────────────────────────────┐
│ 👤 John                                    ID: 0    │
├─────────────────────────────────────────────────────┤
│ IS A                                                │
│ ┌─────────┐ ┌─────────┐                            │
│ │  user   │ │  admin  │                            │
│ └─────────┘ └─────────┘                            │
│ RELATIONSHIPS                                       │
│ ┌───────────────────────────────────────────────┐  │
│ │ John ──likes──→ Pizza_1                       │  │
│ │ John ──manages──→ Alice                       │  │
│ └───────────────────────────────────────────────┘  │
│ ATTRIBUTES                                          │
│ • age: 30                                          │
├─────────────────────────────────────────────────────┤
│ ▶ Developer View                                   │
│   { "denseId": 0, "conceptId": "E:John", ... }     │
└─────────────────────────────────────────────────────┘
```

### Developer View
- Must reflect real session data; no placeholder objects.

## Component D: Rule Visualization

### Display Requirements
1. Natural language sentence: `If ... then ...`
2. Structured IF/THEN breakdown
3. Collapsible Developer View (raw JSON of rule plan)

## Natural Language Generation (Explorer)

### Predicate Formatting
- `P:passive:assigned|to` → `is assigned to`
- `P:not|passive:assigned|to` → `is not assigned to`
- `P:not|manage` → `does not manage`

### Pluralization
Pluralization is intentionally simple (English-only UI):
```javascript
function pluralize(word, count) {
  if (count === 1) return word;
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("ch")) return word + "es";
  if (word.endsWith("y") && !/[aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}
```

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

## Visual Design

### Colors
- Entity (default): #3498db (blue)
- Error: #e74c3c (red)
- Success: #2ecc71 (green)

## References
- DS03: Syntax
- DS04: Semantics
- DS07: Error handling
- DS12: Session API
- DS18: Proof traces
- DS24: Theory consistency checks and issue taxonomy

