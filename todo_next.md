# TODO Next — aliniere implementare ↔ specificații

## Status curent (după fixuri)
- `npm run checkTheories -e theories/base.formal.cnl`: `0` erori, `643` warning-uri.
- Rezolvate complet:
  - Subtipuri reflexive: `0`
  - Cicluri în ierarhia de subtipuri: `0`
  - Label-uri non-engleze importate: `0`
- Importer-ul normalizează acum subtipurile (dedupe, cycle-break, filtrează metaclasele care “curg” în domeniu).
- Parserul Turtle ignoră acum corect comentarii `#` și suportă `"""..."""` ca să nu pierdem `rdfs:label` după definiții multi-line.
- Conflicte globale tip vs predicat: `0` (rezolvat prin redenumiri deterministe la generare, ex: `prov-entity`, `foaf-image`).
- Termeni OBO fără label (ID-uri opace): scoși din output și scriși separat în `00-dictionary.unlabeled.generated.cnl` (audit-only; neload-uit).
- Verificările sunt acum partajate: `src/theories/diagnostics.mjs` este folosit atât de `checkTheories` cât și la încărcarea base-ului în `CNLSession`; Explorer afișează direct issues din sesiune.
- Redenumirile la load-time nu mai sunt “opțiuni ascunse”: sunt directive explicite în `.cnl` (`RenameType:` / `RenamePredicate:`) și produc issue-uri (`LoadTimeRenameApplied` / `LoadTimeRenameConflict`).
- `npm run tests` și `npm run evals` trec.

## TODO R1 — Duplicate între ontologii (cross-ontology)

### Problema
Mai rămân multe warning-uri `DUPLICATE_TYPE` și `DUPLICATE_PREDICATE` (aceleași cuvinte definite în mai multe ontologii).
Unele sunt “legitime” (aceeași noțiune în mai multe ontologii), altele pot ascunde suprapuneri sau semnificații diferite.

### Solutie
 le acceptăm ca warning-uri  `checkTheories`, dar hai sa cautam o solutie sa difenretiem intre ce e legitim (si poate fi ignorat) si ce e conflict real si trebuie sa acceptam ca acelasi cuvint poate avea sensuri 
 diferite in teorii diferite

**Status (implementat parțial):**
- `checkTheories` diferențiază acum între:
  - duplicate benigne (`DuplicateTypeDeclaration`, `DuplicatePredicateDeclaration`)
  - conflicte probabile (`DuplicateTypeDifferentParents`, `DuplicatePredicateDifferentConstraints`)
- În sesiune/Explorer raportăm același set ca `checkTheories` (duplicate + conflicte), ca să fie consistent peste tot; UI-ul le grupează după `kind`.

## TODO R2 — Ce facem cu conflictele “probabile” (sensuri diferite)

### Problemă
Pentru conflictele detectate (ex: același predicat cu domenii/range diferite între ontologii), acum doar le raportăm ca warning în sesiune.

### Solutie
- O2: Aplicăm redenumiri deterministe la generare pentru aceste chei (prefix ontologie doar pentru conflicte), ca la `prov-entity`. 
