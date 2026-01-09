import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./simulate/basic.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Simulate" });
