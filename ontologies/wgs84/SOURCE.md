# Source: WGS84 Geo Positioning (W3C Basic Geo)

- id: `wgs84`
- downloadedAt: `2026-01-13`
- url: https://www.w3.org/2003/01/geo/wgs84_pos.rdf
- sourceFormat: `rdfxml`
- sourceFile: `wgs84_pos.rdf`
- ttlFile: `wgs84_pos.ttl`

Notes:
- The canonical W3C publication is RDF/XML; this repository vendors a Turtle conversion for deterministic imports.

## Description
The WGS84 Basic Geo ontology provides a simple vocabulary for representing latitude, longitude, and altitude information in the WGS84 geodetic reference datum. It is lightweight and widely used for simple point-based tagging.

Key concepts:
- **SpatialThing:** Anything with spatial extent.
- **Point:** A location described by coordinates.
- **Properties:** `lat`, `long`, `alt`, `location`.

## Usage in CNL
Use WGS84 when you need simple, lightweight geotagging without the complexity of full GIS standards like GeoSPARQL:
- **Asset Tracking:** Tagging the location of a truck or package.
- **Points of Interest:** Identifying cities, landmarks, or buildings on a map.
- **Simple Distance:** Calculating proximity between two points.