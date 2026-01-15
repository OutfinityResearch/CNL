# W3C OWL-Time

This ontology is vendored locally to avoid runtime network dependencies.

Expected download URL (content negotiation to Turtle):
- `https://www.w3.org/2006/time`

## Description
W3C OWL-Time is the standard ontology for temporal concepts. It provides a vocabulary for expressing facts about topological relations among instants and intervals, as well as information about durations and date-time information.

Key concepts:
- **TemporalEntity:** Superclass of Intervals and Instants.
- **Instant:** A zero-duration point in time.
- **Interval:** A period of time with a non-zero duration.
- **Relations:** Allen's interval algebra (before, after, meets, overlaps, during, etc.).
- **Duration:** Describing length of time (e.g., "3 days").
- **Calendar/Clock:** Describing date-time values (year, month, day, hour, etc.).

## Usage in CNL
Use OWL-Time for any domain requiring temporal precision:
- **Scheduling:** Defining when events occur relative to each other.
- **History:** Modeling periods, eras, and timelines.
- **Process Modeling:** Defining start and end times for activities.
- **Reasoning:** Inferring temporal order (e.g., if A is during B, and B is before C, then A is before C).