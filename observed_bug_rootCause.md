# Root Cause Analysis: Incorrect Explanation in KB Explorer

## Observation
**User Report:** When executing the command `Explain why Socrates is mortal.`, the system returned an unrelated explanation about "User is Admin" and "Admin -> Access".

## Investigation
1.  **Component Identification:** The response came from the API endpoint `POST /api/command`.
2.  **Code Inspection:** Analyzed `tools/explorer/server/api.mjs`.
3.  **Finding:** The file contains a hardcoded mock response for demo purposes:
    ```javascript
    } else if (lower.startsWith('explain')) {
      output = "Explanation:\n1. Fact (User is Admin)\n2. Rule (Admin -> Access)\n-> Conclusion: User has Access";
    }
    ```
4.  **Mechanism:** The logic checks only if the string starts with `explain`, ignoring the actual subject of the query.

## Root Cause
The **KB Explorer Server API** (`api.mjs`) implements a static mock for the "Explain" pragmatic to simulate functionality in the absence of a fully wired Reasoning Engine. This mock returns a fixed string regardless of the input query.

## Conclusion
The bug is located in the **KBExplorer** tool layer, not the CNL Core.
**Action:** Fix immediately by making the mock dynamic or removing the misleading specific details.
