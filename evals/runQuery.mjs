import { runCaseSuite } from "./cases-runner.mjs";

const fileUrl = new URL("./query/basic.cases", import.meta.url);
await runCaseSuite({ fileUrl, title: "Query" });
