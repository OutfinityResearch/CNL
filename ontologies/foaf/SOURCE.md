# Source: FOAF Turtle snapshot

- id: `foaf`
- downloadedAt: `2026-01-13`
- url: https://gist.githubusercontent.com/baskaufs/fefa1bfbff14a9efc174/raw/389e4b003ef5cbd6901dd8ab8a692b501bc9370e/foaf.ttl
- format: `turtle`
- file: `foaf.ttl`

Notes:
- `xmlns.com/foaf/` was not reliably reachable from the current environment, so a stable, pinned Turtle snapshot is vendored instead.
- If you want a more “official” source later, we can replace this with a FOAF vocabulary release from a canonical repository and re-run `npm run generateTheories`.

## Description
The Friend of a Friend (FOAF) ontology is one of the most widely used vocabularies for describing people, the links between them, and the things they create and do.

Key concepts:
- **Agent:** People, organizations, groups.
- **Person:** Detailed attributes for individuals (name, email, homepage, depiction).
- **Project/Group:** Collaborative efforts and collections of agents.
- **Documents/Images:** Things created or depicted by agents.
- **knows:** The fundamental social networking relationship.

## Usage in CNL
FOAF is the go-to vocabulary for lightweight social modeling:
- **User Profiles:** Storing basic user identity and contact info.
- **Social Networks:** Modeling relationships (who knows whom, membership in groups).
- **Attribution:** Linking documents and creative works to their makers.