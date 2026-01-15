import { readJsonl } from "../_lib/jsonl.mjs";
import { ensureRowsCached } from "../_lib/hf-datasets-server.mjs";
import { translateBabiLocation } from "./translate.mjs";

export default {
  id: "babi-location",
  title: "bAbI QA — Task 1 (Location)",
  description: "Location tracking with templated movement sentences and 'Where is X?' questions.",
  homepage: "https://huggingface.co/datasets/facebook/babi_qa",
  baseEntrypoint: "theories/base.cnl",

  async loadCases({ suiteDir, options }) {
    const dataset = "facebook/babi_qa";
    const config = "en-10k-qa1";
    const split = "test";
    const cacheRows = 1000;
    const cacheKey = `${dataset.replaceAll("/", "__")}__${config}__${split}`;

    const { jsonlPath } = await ensureRowsCached({ suiteDir, cacheKey, dataset, config, split, maxRows: cacheRows });
    return readJsonl(jsonlPath).map((row, index) => ({ ...row, __deepId: index }));
  },

  async translateExample(example) {
    const baseId = `babi_${example.__deepId ?? "unknown"}`;
    const translated = translateBabiLocation(example);

    const items = Array.isArray(translated) ? translated : [translated];
    return items.map((t, idx) => {
      if (t.skip) {
        return {
          caseId: `${baseId}#${idx + 1}`,
          original: example,
          skip: true,
          skipReason: t.skipReason,
          cnl: { theory: "", command: "" },
          expected: null,
        };
      }
      return {
        caseId: `${baseId}#${idx + 1}`,
        original: example,
        skip: false,
        cnl: { theory: t.cnlTheory, command: t.cnlCommand },
        expected: t.expected,
      };
    });
  },
};
