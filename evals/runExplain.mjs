import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./explain/basic.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Explain" });
