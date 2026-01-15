/**
 * Public runtime entrypoint.
 *
 * This module re-exports the stable runtime API used by:
 * - `CNLSession` (DS12)
 * - evaluation runners under `evals/`
 * - KB Explorer server routes under `tools/explorer/server/`
 */
export { executeCommandAst, executeProgram } from "./engine/execute.mjs";
export { materializeRules } from "./engine/materialize.mjs";
export { evaluateCondition } from "./engine/evaluate.mjs";
