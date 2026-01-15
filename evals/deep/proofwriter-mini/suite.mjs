import { readJsonl } from "../_lib/jsonl.mjs";
import { ensureRowsCached } from "../_lib/hf-datasets-server.mjs";
import { translateProofwriterMini } from "./translate.mjs";

export default {
  id: "proofwriter-mini",
  title: "ProofWriter (sampled)",
  description: "Logic-style facts/rules with yes/no/unknown answers (unknown is skipped in v1).",
  homepage: "https://huggingface.co/datasets/tasksource/proofwriter",
  baseEntrypoint: "theories/base.cnl",

  async loadCases({ suiteDir, options }) {
    const dataset = "tasksource/proofwriter";
    const config = "default";
    const split = "validation";
    const cacheRows = 1000;
    const cacheKey = `${dataset.replaceAll("/", "__")}__${config}__${split}`;

    const { jsonlPath } = await ensureRowsCached({ suiteDir, cacheKey, dataset, config, split, maxRows: cacheRows });
    return readJsonl(jsonlPath).map((row, index) => ({ ...row, __deepId: index }));
  },

  async translateExample(example) {
    const translated = translateProofwriterMini(example);
    if (translated.skip) {
      return [
        {
          caseId: `proofwriter_${example.__deepId ?? "unknown"}`,
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
        caseId: `proofwriter_${example.__deepId ?? "unknown"}`,
        original: example,
        skip: false,
        cnl: { theory: translated.cnlTheory, command: translated.cnlCommand },
        expected: translated.expected,
      },
    ];
  },
};
