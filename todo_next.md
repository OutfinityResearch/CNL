# TODO Next — aliniere implementare ↔ specificații

## Status curent (după fixuri)
- `npm run checkTheories -e theories/base.formal.cnl`: `0` erori, `114` warning-uri.
- Rezolvate complet:
  - Subtipuri reflexive: `0`
  - Cicluri în ierarhia de subtipuri: `0`
  - Label-uri non-engleze importate: `0`
- Importer-ul normalizează acum subtipurile (dedupe, cycle-break, filtrează metaclasele care “curg” în domeniu).
- Parserul Turtle ignoră acum corect comentarii `#` și suportă `"""..."""` ca să nu pierdem `rdfs:label` după definiții multi-line.
- Conflicte globale tip vs predicat: `0` (rezolvat prin redenumiri deterministe la generare, ex: `prov-entity`, `foaf-image`).
- Termeni OBO fără label (ID-uri opace): scoși din output și scriși separat în `00-dictionary.unlabeled.generated.cnl` (audit-only; neload-uit).

## TODO R1 — Duplicate între ontologii (cross-ontology)

### Problema
Mai rămân multe warning-uri `DUPLICATE_TYPE` și `DUPLICATE_PREDICATE` (aceleași cuvinte definite în mai multe ontologii).
Unele sunt “legitime” (aceeași noțiune în mai multe ontologii), altele pot ascunde suprapuneri sau semnificații diferite.

### Solutie
 le acceptăm ca warning-uri  `checkTheories`, dar hai sa cautam o solutie sa difenretiem intre ce e legitim (si poate fi ignorat) si ce e conflict real si trebuie sa acceptam ca acelasi cuvint poate avea sensuri 
 diferite in teorii diferite
