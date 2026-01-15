# Core Theories Improvement Plan

## Overview
This document outlines the strategy for evolving the core CNL theory bundles (`base`, `base.formal`, `legal`, `literature`) to better support their intended use cases. We aim to integrate standard ontologies to provide robust vocabulary and axioms without reinventing the wheel.

## 1. `theories/base.cnl` (Everyday Discourse)
**Goal:** Support normal, casual discussion, light literature reading, and general knowledge.
**Current Status:** Minimal.
**Missing Capabilities:**
- Basic concepts of Time and Dates (Simpler than OWL-Time?)
- Basic People and Relationships.
- Basic Places.

**Proposed Additions:**
- **FOAF (Friend of a Friend):** For simple agents, people, and groups.
- **WGS84:** For basic point locations.
- **W3C-Time (Lite profile):** For basic temporal ordering.
- **Schema.org (Subset):** Potentially useful for "Common Sense" objects (Event, Place, Person, CreativeWork) if a lightweight translation exists.

---

## 2. `theories/base.formal.cnl` (Popular Science & Sci-Fi)
**Goal:** Support popular science explanation, science fiction writing, and structured reasoning about the physical world.
**Current Status:** Undefined / Generic.
**Missing Capabilities:**
- **Measurement & Units:** Critical for any science (mass, distance, velocity).
- **Observation:** How we measure things.
- **Systems:** Matter, Energy, Space.

**Proposed Additions:**
- **QUDT (Quantities, Units, Dimensions, and Types):** *High Priority.* Essential for saying "5 meters", "10 lightyears", "300 Kelvin".
- **SSN/SOSA (Semantic Sensor Network):** For observations, sampling, and sensors (useful for Sci-Fi ship logs or scientific experiments).
- **BFO (Basic Formal Ontology) / RO (Relation Ontology):** A stricter upper model to distinguish objects from processes (e.g., "The explosion (Process) destroyed the ship (Object)").

---

## 3. `theories/literature.cnl` (Analysis & Critique)
**Goal:** Literary criticism, theoretical analysis, style analysis, documentation quality assessment, and presentation structure.
**Current Status:** Includes FRBR and FaBiO. Good for bibliography.
**Missing Capabilities:**
- **Document Structure:** Analyzing "Documentation Quality" requires understanding Chapters, Sections, Paragraphs, Lists.
- **Rhetoric & Argumentation:** Analyzing the "logic" or "style" of a text.
- **Emotions:** Analyzing the tone or mood of a literary work.

**Proposed Additions:**
- **DoCO (Document Components Ontology):** *High Priority.* Extends FaBiO/FRBR to describe structural components (Introduction, Chapter, Figure, Footnote). Essential for "documentation quality" analysis.
- **MFOEM (Emotion Ontology):** For tagging scenes or character states with specific emotions (Joy, Anger, Melancholy).
- **AIF (Argument Interchange Format):** For mapping arguments within a text (Premise, Conclusion, Conflict).
- **Rhetorical Structure Theory (RST):** If a suitable OWL representation exists, for analyzing text coherence.

---

## 4. `theories/legal.cnl` (Juridical)
**Goal:** Reading and reasoning about legal documents.
**Current Status:** Strong foundation with LKIF-Core.
**Missing Capabilities:**
- **Commercial/Financial context:** Contracts often involve money and business entities.

**Proposed Additions:**
- **FIBO (Financial Industry Business Ontology):** A subset for basic financial concepts (Currency, Contract, Corporation) might complement LKIF.

## Action Items

1. [x] **Research QUDT:** Evaluate complexity of importing QUDT for `base.formal`. (Used Mini version)
2. [x] **Research DoCO:** Verify compatibility with our existing FaBiO import. (Imported)
3. [x] **Research MFOEM:** Check if it fits the "Literary Criticism" use case. (Created Mini version)
4. [x] **Draft `base.cnl`:** Explicitly import FOAF and WGS84. (Done + Schema.org)
5. [x] **Draft `base.formal.cnl`:** Prototype a "Sci-Fi" scenario using measurement units. (Imports added: QUDT, SSN)

## Executed Improvements (Jan 14, 2026)

- **New Ontologies Added:**
    - `ontologies/qudt` (Mini-Schema + Units) -> `base.formal.cnl`
    - `ontologies/ssn` (Full W3C Integrated) -> `base.formal.cnl`
    - `ontologies/aif` (Mini-AIF) -> `literature.cnl`
    - `ontologies/fibo` (Mini-Agents) -> `legal.cnl`
    - `ontologies/schema` (Full Schema.org) -> `base.cnl`
    - `ontologies/mfoem` (Mini-MFOEM) -> `literature.cnl`
    - `ontologies/doco` (Existing) -> `literature.cnl`

- **Process:**
    - Created `SOURCE.md` documentation for all new additions.
    - Generated CNL via `npm run generateTheories`.
    - Validated with `npm run checkTheories`.

## Known Issues & Next Steps

### 1. High Volume of Warnings (Duplication)
`base.formal.cnl` reports 177 warnings, mostly `DuplicatePredicateDifferentConstraints` and `DuplicateTypeDifferentParents`.
**Impact:** Semantic ambiguity. If `person` inherits from `agent` in one ontology and `living_thing` in another, the compiler merges them, but property constraints might conflict.
**Fix:**
- Create an **Alignment Theory** (`theories/alignment.cnl`) to explicitly map equivalent concepts (e.g., `schema:Person` vs `foaf:Person`).
- Use the `canonical-keys.mjs` tool (if available) to unify keys during import.

### 2. "Mini" Ontologies
To facilitate immediate usage, "Mini" versions were created for QUDT, AIF, FIBO, and MFOEM.
**Fix:**
- Plan a full migration to the official distributions once the `import.mjs` tool supports large-scale filtering or tree-shaking (to avoid 100MB+ imports).
- Verify `literature-extensions.cnl` requirements and recreate the file if needed.

