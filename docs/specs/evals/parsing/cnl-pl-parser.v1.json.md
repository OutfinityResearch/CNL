# evals/parsing/cnl-pl-parser.v1.json

## Purpose
Canonical parser evaluation corpus with valid and invalid cases aligned to DS03 and DS07.

## Contents
- V001-V049: valid inputs with expected AST output.
- X001-X020: invalid inputs with expected error codes and offending tokens/fields.
## Related Files
- `evals/parsing/cnl-pl-actions-and-labels.v1.json` adds action block and label syntax cases.
- `evals/parsing/cnl-pl-labels.v1.json` adds missing colon cases for Rule/Command labels.

## Notes
- Use this file for end-to-end parser regression checks.
- Error objects follow the DS07 standard format and codes.
