# Raport de Revizuire a Specificațiilor CNL-PL

Acest document sumarizează inconsistențele, lipsurile și riscurile identificate în urma analizei setului de specificații `DS01` - `DS22`.

## 1. Specificații Lipsă

### 1.1. Modul `Optimize`
[REZOLVAT] - Specificația `DS23-optimization.md` a fost creată.

## 2. Inconsistențe Structurale și de Sintaxă

### 2.1. Variabile (`?X`) vs. Placeholders (`X`, `Y`)
Există un risc cognitiv major în distincția dintre variabilele de runtime și șabloanele de compilare.
*   **DS03:** Interzice explicit variabilele (`?X`) în afara comenzilor `Solve` / `Optimize`.
*   **DS10:** Introduce "Placeholder Rule Templates" folosind litere simple (`X`, `Y`, `Z`) pentru reguli specifice (compoziție, inversă etc.).
*   **Problema:** Un utilizator ar putea încerca să scrie reguli generale folosind `X` și `Y` (ex: `Rule: If X is generic then...`), care vor eșua silențios sau cu erori criptice dacă nu se potrivesc exact șabloanelor limitate din DS10. Nu există un cod de eroare specificat pentru "utilizare invalidă a placeholder-elor".

## 3. Riscuri de Implementare și Arhitectură

### 3.1. Ambiguitatea `FactID` și Provenance
*   **DS09:** Specifică faptul că `FactID` este derivat (hash/packing) și că, în caz de coliziune, se stochează o listă de coliziuni.
*   **DS15 & DS18:** Se bazează pe `FactID` pentru a construi arborele de justificare (`Provenance`).
*   **Conflict:** Dacă `FactID` este doar hash-ul, și există o coliziune, mecanismul de `Explain` nu are cum să știe *care* dintre faptele din lista de coliziune a generat deducția. Specificația nu detaliază rezoluția coliziunilor în contextul justificărilor.

### 3.2. Tokenizarea keyword-ului `has`
*   **DS03:** `has` este un keyword rezervat (pentru atribute). IDENT permite cratime (`[A-Za-z0-9_-]*`).
*   **DS22:** Importul ontologiilor mapează proprietățile OWL `hasX` la tokeni cu cratimă (ex: `has-beginning`).
*   **Status:** [VERIFICAT - SIGUR]
    *   Analiza codului `src/lexer/tokenizer.mjs` confirmă că lexerul folosește un consum lacom (greedy) pentru identificatori, incluzând cratimele.
    *   Testul `tests/lexer/tokenizer.test.mjs` confirmă comportamentul.

## 4. Inconsecvențe în Naming și Convenții

### 4.1. Naming-ul fișierelor generate
*   **DS14:** Referă fișierele de bază cu prefixul `base-` (ex: `00-base-dictionary.generated.cnl`).
*   **DS22:** Specifică output-ul importului fără prefix (ex: `00-dictionary.generated.cnl`).
*   **Observație:** Aceasta nu este o eroare critică, dar creează o asimetrie în structura folderului `theories/`.

## 5. Recomandări

1.  **FactID:** Revizuirea strategiei de hash pentru a garanta unicitatea sau includerea indexului de coliziune în referința de proveniență.
