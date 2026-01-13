import { DEMO_SUITE } from "../../../../../evals/kbDemo/suite.mjs";
import { json } from "../helpers.mjs";

export function handleExamples(req, res, url) {
  if (req.method !== "GET" || url.pathname !== "/api/examples") return false;
  json(res, 200, { suite: DEMO_SUITE });
  return true;
}
