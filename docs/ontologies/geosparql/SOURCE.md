# Source: OGC GeoSPARQL 1.1

- id: `geosparql`
- downloadedAt: `2026-01-13`
- url: http://www.opengis.net/ont/geosparql
- retrievedAs: `text/turtle` (content negotiation)
- finalUrl: https://opengeospatial.github.io/ogc-geosparql/geosparql11/geo.ttl
- file: `geosparql.ttl`

Notes:
- The canonical identifier is `http://www.opengis.net/ont/geosparql` and redirects; this repository vendors the Turtle payload for deterministic imports.

## Description
GeoSPARQL is the Open Geospatial Consortium (OGC) standard for representing and querying geospatial data on the Semantic Web.

Key capabilities:
- **Feature:** A domain object representing a real-world entity (e.g., a river, a city).
- **Geometry:** The spatial representation of a feature (points, lines, polygons).
- **Serialization:** Supports WKT (Well-Known Text) and GML (Geography Markup Language) literals.
- **Spatial Relations:** Definitive topological relations (e.g., `sfContains`, `sfOverlaps`, `sfTouches`, `ehInside`) for spatial reasoning.

## Usage in CNL
GeoSPARQL is essential for any location-aware application:
- **GIS Integration:** Linking knowledge graph entities to map coordinates.
- **Spatial Reasoning:** inferring relationships like "Is this building inside the flood zone?" or "Which customers are near this store?".
- **Mapping:** Providing standard geometry formats for visualization tools.