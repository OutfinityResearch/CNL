# Revizuire Specificații CNL-PL (Specs Review)

Acest document conține o analiză a specificațiilor curente din directorul `docs/specs`, evidențiind punctele forte, slăbiciunile și recomandările pentru îmbunătățire.

## 1. Analiza Documentelor de Design (DS)

### DS01 - Vision
- **Puncte forte:** Definește clar scopul "determinismului" într-un limbaj natural, diferențiindu-se de LLM-uri sau parsere NLP clasice.
- **Slăbiciuni:** Nu detaliază suficient curba de învățare pentru utilizatori. Deși se dorește "readability for non-experts", regulile stricte (ex: repetarea pronumelor relative) pot face scrierea dificilă.
- **Recomandare:** Adăugarea unei secțiuni despre "User Experience" și mesaje de eroare prietenoase.

### DS02 - Implementation Plan
- **Puncte forte:** Maparea oglindă (mirroring) între `src` și `docs/specs` este o idee excelentă pentru menținerea documentației.
- **Slăbiciuni:** Lista de fișiere planificată nu pare să fie actualizată complet cu realitatea din repository (ex: structura `src/ids` sau `src/theories` apare în fișiere dar nu explicit în DS02).
- **Recomandare:** Sincronizarea automată sau periodică a structurii de directoare din DS02 cu realitatea.

### DS03 - Syntax
- **Puncte forte:** Definirea propoziției atomice prin triplete SVO tipizate (Copula, Comparison, Attribute, Relation) este robustă și elimină ambiguitatea.
- **Slăbiciuni:** 
  - Regula "Noun Phrase must start with determiner" este restrictivă pentru nume proprii sau concepte abstracte care în engleză nu cer mereu articol.
  - "Relative chains must repeat the pronoun" reduce fluiditatea textului.
- **Recomandare:** Exemple mai multe pentru cazuri limită (edge cases) și clarificarea tratamentului pentru substantive numărabile vs nenumărabile.

### DS04 - Semantics & Pragmatics
- **Puncte forte:** Separarea clară a modurilor de execuție (Query, Proof, Plan, etc.).
- **Slăbiciuni:** Nu este clar cum interacționează pragmaticele între ele (ex: un `Plan` poate invoca un `Query` intern?). Definirea "Justification chain" pentru `Explain` este vagă.
- **Recomandare:** Diagrame de secvență pentru fluxul de execuție al fiecărei comenzi pragmatice.

### DS09 & DS10 - Knowledge Base & Compilation
- **Puncte forte:** Utilizarea `Bitset` pentru indecși și separarea `RelationMatrix` este foarte performantă pentru interogări.
- **Slăbiciuni:** 
  - Gestionarea coliziunilor pentru `FactID` (128-bit hash) este menționată doar ca "store collision maps only when needed", ceea ce ascunde complexitate.
  - Lipsa detaliilor despre tranzacționalitate sau atomicitea actualizărilor în KB.
- **Recomandare:** Detalierea mecanismului de "interning" și a politicii de gestionare a memoriei pentru KB-uri mari.

## 2. Probleme Identificate (General)

1.  **Lipsa Exemplelor Concrete Complexe:** Majoritatea exemplelor sunt propoziții simple. Lipsesc scenarii "End-to-End" care să combine definiții, reguli și interogări complexe.
2.  **Gap între Sintaxă și Semantică:** Nu este explicit cum se propagă erorile semantice (ex: tipuri incompatibile la runtime) înapoi la linia de cod sursă din CNL.
3.  **Vocabular Tehnic:** Termeni precum "Pragmatics", "Interners", "Bitset interface" sunt folosiți frecvent fără a fi definiți într-un loc centralizat accesibil utilizatorului non-tehnic.

## 3. Plan de Îmbunătățire a Documentației

Pentru a remedia aceste probleme, propunem următoarele acțiuni (detaliate în răspunsul principal):
1.  Actualizarea paginilor HTML pentru a reflecta structura curentă.
2.  Crearea unui **Wiki** pentru termeni.
3.  Adăugarea unei secțiuni de **Tutoriale** pas-cu-pas.
