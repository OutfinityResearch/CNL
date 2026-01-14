import { IRI, literalText } from "./model.mjs";
import { isIri, localNameFromIri } from "./iris.mjs";

function iriOf(node) {
  return typeof node === "string" ? node : null;
}

function ensureSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

export function extractOntologySchema(triples) {
  const classes = new Set();
  const properties = new Set();
  const labels = new Map();
  const labelScores = new Map();

  const labelPredicateWeights = new Map([
    [IRI.rdfsLabel, 30],
    [IRI.skosPrefLabel, 30],
    [IRI.oboIAOEditorPreferredTerm, 25],
    [IRI.oboInOwlHasExactSynonym, 20],
  ]);

  const subClassOf = new Map(); // child -> Set(parent)
  const subPropertyOf = new Map(); // child -> Set(parent)
  const domain = new Map(); // prop -> Set(class)
  const range = new Map(); // prop -> Set(class)
  const inverseOf = new Map(); // prop -> Set(prop)
  const transitive = new Set(); // prop
  const symmetric = new Set(); // prop
  const equivalentClass = new Map(); // a -> Set(b)
  const equivalentProperty = new Map(); // a -> Set(b)

  for (const t of triples) {
    const s = iriOf(t.subject);
    const p = iriOf(t.predicate);
    const oIri = iriOf(t.object);
    const oLit = literalText(t.object);
    const oLang = t.object && typeof t.object === "object" && "lang" in t.object ? t.object.lang : null;

    if (labelPredicateWeights.has(p)) {
      if (s && oLit) {
        const lang = typeof oLang === "string" ? oLang.toLowerCase() : null;
        if (lang && !lang.startsWith("en")) continue;
        const score = (labelPredicateWeights.get(p) ?? 0) + (lang ? 3 : 2);
        const prevScore = labelScores.get(s) ?? -1;
        if (score > prevScore) {
          labels.set(s, oLit);
          labelScores.set(s, score);
        }
      }
      continue;
    }

    if (p === IRI.rdfType && oIri) {
      if (oIri === IRI.owlClass || oIri === IRI.rdfsClass) {
        if (s) classes.add(s);
        continue;
      }
      if (oIri === IRI.owlObjectProperty || oIri === IRI.owlDatatypeProperty || oIri === IRI.rdfProperty) {
        if (s) properties.add(s);
        continue;
      }
      if (oIri === IRI.owlTransitiveProperty) {
        if (s) {
          properties.add(s);
          transitive.add(s);
        }
        continue;
      }
      if (oIri === IRI.owlSymmetricProperty) {
        if (s) {
          properties.add(s);
          symmetric.add(s);
        }
        continue;
      }
    }

    if (p === IRI.rdfsSubClassOf && s && oIri) {
      ensureSet(subClassOf, s).add(oIri);
      classes.add(s);
      classes.add(oIri);
      continue;
    }

    if (p === IRI.rdfsSubPropertyOf && s && oIri) {
      ensureSet(subPropertyOf, s).add(oIri);
      properties.add(s);
      properties.add(oIri);
      continue;
    }

    if (p === IRI.rdfsDomain && s && oIri) {
      ensureSet(domain, s).add(oIri);
      properties.add(s);
      classes.add(oIri);
      continue;
    }

    if (p === IRI.rdfsRange && s && oIri) {
      ensureSet(range, s).add(oIri);
      properties.add(s);
      classes.add(oIri);
      continue;
    }

    if (p === IRI.owlInverseOf && s && oIri) {
      ensureSet(inverseOf, s).add(oIri);
      ensureSet(inverseOf, oIri).add(s);
      properties.add(s);
      properties.add(oIri);
      continue;
    }

    if (p === IRI.owlEquivalentClass && s && oIri) {
      ensureSet(equivalentClass, s).add(oIri);
      ensureSet(equivalentClass, oIri).add(s);
      classes.add(s);
      classes.add(oIri);
      continue;
    }

    if (p === IRI.owlEquivalentProperty && s && oIri) {
      ensureSet(equivalentProperty, s).add(oIri);
      ensureSet(equivalentProperty, oIri).add(s);
      properties.add(s);
      properties.add(oIri);
      continue;
    }
  }

  // Seed missing labels from local names, but keep original label preference.
  for (const iri of [...classes, ...properties]) {
    if (!labels.has(iri) && isIri(iri)) {
      labels.set(iri, localNameFromIri(iri));
      labelScores.set(iri, 0);
    }
  }

  // Resolve class/property collisions (same IRI appears as both).
  // Strategy (DS24): if a term has property-like signals (domain/range/subPropertyOf/inverse/transitive/symmetric),
  // treat it as a property; otherwise treat it as a class.
  const conflicts = [];
  for (const iri of [...classes]) {
    if (!properties.has(iri)) continue;
    const hasPropertySignals =
      domain.has(iri) ||
      range.has(iri) ||
      subPropertyOf.has(iri) ||
      inverseOf.has(iri) ||
      transitive.has(iri) ||
      symmetric.has(iri) ||
      equivalentProperty.has(iri);

    if (hasPropertySignals) {
      classes.delete(iri);
      conflicts.push({ iri, chosen: "property", reason: "domain/range/subPropertyOf/inverse/transitive/symmetric/equivalentProperty" });

      // Drop class-only edges that reference the removed class to keep rendering deterministic.
      subClassOf.delete(iri);
      equivalentClass.delete(iri);
      for (const [child, parents] of subClassOf.entries()) {
        parents.delete(iri);
        if (parents.size === 0) subClassOf.delete(child);
      }
      for (const [a, bs] of equivalentClass.entries()) {
        bs.delete(iri);
        if (bs.size === 0) equivalentClass.delete(a);
      }
    } else {
      properties.delete(iri);
      conflicts.push({ iri, chosen: "class", reason: "no property-like signals" });

      // Drop property-only edges that reference the removed property.
      subPropertyOf.delete(iri);
      domain.delete(iri);
      range.delete(iri);
      inverseOf.delete(iri);
      transitive.delete(iri);
      symmetric.delete(iri);
      equivalentProperty.delete(iri);
      for (const [child, parents] of subPropertyOf.entries()) {
        parents.delete(iri);
        if (parents.size === 0) subPropertyOf.delete(child);
      }
      for (const [p, qs] of inverseOf.entries()) {
        qs.delete(iri);
        if (qs.size === 0) inverseOf.delete(p);
      }
      for (const [a, bs] of equivalentProperty.entries()) {
        bs.delete(iri);
        if (bs.size === 0) equivalentProperty.delete(a);
      }
    }
  }

  return {
    classes,
    properties,
    labels,
    labelScores,
    conflicts,
    subClassOf,
    subPropertyOf,
    domain,
    range,
    inverseOf,
    transitive,
    symmetric,
    equivalentClass,
    equivalentProperty,
  };
}
