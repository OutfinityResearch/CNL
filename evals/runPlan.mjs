import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./planning/basic.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Plan" });
