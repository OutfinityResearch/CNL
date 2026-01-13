# Ontologies (Local, Vendored)

This folder stores **local ontology sources** (e.g. Turtle `.ttl`) that can be imported into CNL using the ontology importer (DS22).

## Why this exists
- Keep ontology inputs **vendored in-repo** (no runtime network dependency).
- Make the import workflow transparent and reproducible.
- Allow adding many domain ontologies over time (science, engineering, medicine, etc.).

## Folder convention
Each ontology lives in its own subfolder:
```
ontologies/<id>/
  *.ttl
  README.md (optional)
```

The folder name `<id>` is used as:
- Output folder naming under `theories/ontologies/<id>/`
- Default context name for imported rules (derived deterministically from `<id>`)

## Regenerating CNL
Run:
```
npm run generateTheories
```

This scans `ontologies/*/*.ttl` and generates:
- `.generated.cnl` (overwritten)
- `.extra.cnl` (manual additions; duplicates removed if also generated)

See `tools/ontology-import/README.md` for details.

Note: the importer prefers English labels (`@en`, `@en-*`) when the source ontology includes multilingual `rdfs:label` / `skos:prefLabel`.

## Downloading classic ontologies
Some upstream ontologies are published as RDF/XML (`.rdf` / `.owl`). To keep the importer simple (Turtle-only), we provide a helper that downloads and converts sources to `.ttl`:
```
npm run downloadOntologies
```
