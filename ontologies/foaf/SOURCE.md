# Source: FOAF Turtle snapshot

- id: `foaf`
- downloadedAt: `2026-01-13`
- url: https://gist.githubusercontent.com/baskaufs/fefa1bfbff14a9efc174/raw/389e4b003ef5cbd6901dd8ab8a692b501bc9370e/foaf.ttl
- format: `turtle`
- file: `foaf.ttl`

Notes:
- `xmlns.com/foaf/` was not reliably reachable from the current environment, so a stable, pinned Turtle snapshot is vendored instead.
- If you want a more “official” source later, we can replace this with a FOAF vocabulary release from a canonical repository and re-run `npm run generateTheories`.
