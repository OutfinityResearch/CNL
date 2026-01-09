# src/pragmatics/commands.mjs

## Purpose
Parses and models pragmatic commands such as Return, Verify, Plan, and Find.

## Responsibilities
- Identify command type from tokens.
- Attach the parsed sentence or condition as the command payload.
- Preserve spans for command-level diagnostics.
