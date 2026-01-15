#!/usr/bin/env node
import { main } from "./evals/runDeep.mjs";

main().then((code) => process.exit(code));
