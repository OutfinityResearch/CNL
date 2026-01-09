import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./solve/basic.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Solve" });
