# evals/parsing/cnl-pl-actions-and-labels.v1.json

## Purpose
Dedicated parsing corpus for action blocks and label syntax edge cases.

## Contents
- V044: valid action block with intent.
- X023-X027: missing colon after Action/Agent/Precondition/Effect/Intent labels.
- X028: duplicate Intent field inside an action block.

## Notes
- Use alongside `cnl-pl-parser.v1.json` to cover structural parsing behavior.
