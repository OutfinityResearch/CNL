import fs from "node:fs";
import path from "node:path";
import { readJsonl } from "../_lib/jsonl.mjs";
import { translateProofwriterMini } from "./translate.mjs";

function existingDataFiles(suiteDir) {
  const dataDir = path.join(suiteDir, "data");
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dataDir, f));
  return files;
}

export default {
  id: "proofwriter-mini",
  title: "ProofWriter (mini) — fixtures + cached jsonl",
  description: "Logic-style facts/rules with yes/no/unknown answers (unknown is skipped in v1).",
  homepage: "https://huggingface.co/datasets",
  baseEntrypoint: "theories/base.cnl",

  async loadCases({ suiteDir }) {
    // NOTE: this suite currently runs from fixtures unless the user provides cached jsonl files in `data/`.
    // (Suite-specific download URLs are intentionally not hard-coded until we agree on the exact HF dataset path.)
    const files = existingDataFiles(suiteDir);
    if (files.length > 0) {
      return files.sort().flatMap((f) => readJsonl(f));
    }
    return readJsonl(path.join(suiteDir, "fixtures.jsonl"));
  },

  async translateExample(example) {
    const translated = translateProofwriterMini(example);
    if (translated.skip) {
      return [
        {
          caseId: example.id || "unknown",
          original: example,
          skip: true,
          skipReason: translated.skipReason,
          cnl: { theory: "", command: "" },
          expected: null,
        },
      ];
    }
    return [
      {
        caseId: example.id || "unknown",
        original: example,
        skip: false,
        cnl: { theory: translated.cnlTheory, command: translated.cnlCommand },
        expected: translated.expected,
      },
    ];
  },
};
