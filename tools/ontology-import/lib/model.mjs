export const NS = Object.freeze({
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  oboInOwl: "http://www.geneontology.org/formats/oboInOwl#",
  obo: "http://purl.obolibrary.org/obo/",
});

export const IRI = Object.freeze({
  rdfType: `${NS.rdf}type`,
  rdfsClass: `${NS.rdfs}Class`,
  owlClass: `${NS.owl}Class`,
  rdfProperty: `${NS.rdf}Property`,
  owlObjectProperty: `${NS.owl}ObjectProperty`,
  owlDatatypeProperty: `${NS.owl}DatatypeProperty`,
  rdfsSubClassOf: `${NS.rdfs}subClassOf`,
  rdfsSubPropertyOf: `${NS.rdfs}subPropertyOf`,
  rdfsDomain: `${NS.rdfs}domain`,
  rdfsRange: `${NS.rdfs}range`,
  rdfsLabel: `${NS.rdfs}label`,
  skosPrefLabel: `${NS.skos}prefLabel`,
  oboInOwlHasExactSynonym: `${NS.oboInOwl}hasExactSynonym`,
  oboIAOEditorPreferredTerm: `${NS.obo}IAO_0000111`,
  owlInverseOf: `${NS.owl}inverseOf`,
  owlTransitiveProperty: `${NS.owl}TransitiveProperty`,
  owlSymmetricProperty: `${NS.owl}SymmetricProperty`,
  owlEquivalentClass: `${NS.owl}equivalentClass`,
  owlEquivalentProperty: `${NS.owl}equivalentProperty`,
});

export function literalText(node) {
  if (!node || typeof node !== "object") return null;
  if (!("literal" in node)) return null;
  return String(node.literal);
}
