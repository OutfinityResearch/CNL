import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./reasoning/mini-theories.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Reasoning" });
