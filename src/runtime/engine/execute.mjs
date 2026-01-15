import { executeSet } from "../../plans/execute.mjs";
import { applyDictionaryStatement } from "../../compiler/dictionary.mjs";
import { compileProgram } from "../../compiler/compile.mjs";
import { compileCommand, compileNP } from "../../compiler/ast-to-plan.mjs";
import {
  collectEntities,
  collectVariables,
  hasVariables,
  isNameProjection,
  runtimeError,
} from "./helpers.mjs";
import { evaluateCondition, evaluateConditionTri } from "./evaluate.mjs";
import { solveWithVariables } from "./solver.mjs";
import { planWithActions } from "./plan.mjs";
import { simulateTransitions } from "./simulate.mjs";
import { materializeRules } from "./materialize.mjs";
import { evaluateAggregation } from "./optimize.mjs";
import { explainAssertion } from "./explain.mjs";
import { buildProofTraceForVerify } from "./proof-traces.mjs";
import { buildWitnessTraceForSet } from "./witness-traces.mjs";
import { renderNodeText, renderConditionText } from "./ast-render.mjs";

function describeObjective(expr) {
  if (!expr) return "objective";
  if (expr.kind === "NumberLiteral") return String(expr.value);
  if (expr.kind !== "AggregationExpr") return expr.kind || "objective";
  const setText = renderNodeText(expr.set);
  if (expr.agg === "NumberOf") {
    return `the number of ${setText || "entities"}`;
  }
  const attrText = expr.attribute ? renderNodeText(expr.attribute) : "attribute";
  return `${expr.agg.toLowerCase()} of ${attrText} of ${setText || "entities"}`;
}

export function executeCommandAst(command, state) {
  if (!command) return { error: "Missing command." };

  if (
    hasVariables(command) &&
    command.kind !== "SolveCommand" &&
    command.kind !== "MaximizeCommand" &&
    command.kind !== "MinimizeCommand"
  ) {
    return { error: runtimeError("SES020", "Variables are only supported in solve/optimize commands.", "Solve") };
  }

  switch (command.kind) {
    case "ReturnCommand": {
      let set = null;
      let plan = null;
      if (isNameProjection(command.expr)) {
        const target = command.expr.pp[0].object;
        plan = compileNP(target, state);
        set = executeSet(plan, state.kb.kb);
      } else {
        const compiled = compileCommand(command, state);
        plan = compiled.set;
        set = executeSet(compiled.set, state.kb.kb);
      }
      const entities = collectEntities(set, state);
      return { kind: "QueryResult", entities, proof: buildWitnessTraceForSet(plan, entities, state) };
    }
    case "FindCommand": {
      const plan = compileCommand(command, state);
      const set = executeSet(plan.set, state.kb.kb);
      const entities = collectEntities(set, state);
      return { kind: "QueryResult", entities, proof: buildWitnessTraceForSet(plan.set, entities, state) };
    }
    case "SolveCommand": {
      if (hasVariables(command)) {
        return solveWithVariables(command, state);
      }
      const plan = compileCommand(command, state);
      const set = executeSet(plan.set, state.kb.kb);
      const entities = collectEntities(set, state);
      return { kind: "SolveResult", entities, proof: buildWitnessTraceForSet(plan.set, entities, state) };
    }
    case "VerifyCommand": {
      const tri = evaluateConditionTri(command.proposition, state);
      const value = tri === "true" ? true : tri === "false" ? false : "unknown";
      return { kind: "ProofResult", value, proof: buildProofTraceForVerify(command, state, value) };
    }
    case "ExplainCommand": {
      if (command.proposition?.kind !== "AtomicCondition") {
        return { error: "Explain requires a single atomic condition." };
      }
      return explainAssertion(command.proposition.assertion, state);
    }
    case "PlanCommand": {
      return planWithActions(command, state);
    }
    case "SimulateCommand": {
      return simulateTransitions(command, state);
    }
    case "MaximizeCommand":
    case "MinimizeCommand": {
      if (hasVariables(command.objective)) {
        return { error: runtimeError("SES023", "Optimize objective does not support variables.", "objective") };
      }
      const constraintVars = new Set();
      collectVariables(command.constraint, constraintVars);
      let solveProof = null;
      if (constraintVars.size > 0) {
        const variables = Array.from(constraintVars, (name) => ({ kind: "Variable", name }));
        const solveResult = solveWithVariables({ ...command, variables, expr: null }, state);
        if (solveResult?.error) return solveResult;
        solveProof = solveResult?.proof ?? null;
        const hasAny = Object.values(solveResult.bindings ?? {}).some((list) => list.length > 0);
        if (!hasAny) {
          const steps = [];
          steps.push(`Constraint: ${renderConditionText(command.constraint) || "constraint"}.`);
          if (solveProof?.kind === "ProofTrace") {
            steps.push("Search found no feasible assignment.");
            solveProof.steps?.slice(0, 60).forEach((line) => steps.push(String(line)));
          } else {
            steps.push("Search found no feasible assignment.");
          }
          return {
            kind: "OptimizeResult",
            status: "unsatisfied",
            value: Number.NaN,
            proof: {
              kind: "ProofTrace",
              mode: "SolveSearch",
              conclusion: "optimization (unsatisfied)",
              answerSummary: "unsatisfied",
              steps,
              premises: solveProof?.premises ?? [],
            },
          };
        }
      } else {
        const ok = evaluateCondition(command.constraint, state);
        if (!ok) {
          const constraintProof = buildProofTraceForVerify({ proposition: command.constraint }, state, false);
          const steps = [];
          steps.push(`Constraint: ${renderConditionText(command.constraint) || "constraint"}.`);
          if (constraintProof?.steps?.length) {
            constraintProof.steps.slice(0, 40).forEach((line) => steps.push(String(line)));
          } else {
            steps.push("Constraint is not satisfied in the current state.");
          }
          return {
            kind: "OptimizeResult",
            status: "unsatisfied",
            value: Number.NaN,
            proof: {
              kind: "ProofTrace",
              mode: "Derivation",
              conclusion: "optimization (unsatisfied)",
              answerSummary: "unsatisfied",
              steps,
              premises: constraintProof?.premises ?? [],
            },
          };
        }
      }
      let value = Number.NaN;
      if (command.objective?.kind === "AggregationExpr") {
        value = evaluateAggregation(command.objective, state);
      } else if (command.objective?.kind === "NumberLiteral") {
        value = command.objective.value;
      }
      const steps = [];
      steps.push(`Constraint: ${renderConditionText(command.constraint) || "constraint"}.`);
      if (solveProof?.kind === "ProofTrace") {
        steps.push("Feasible assignments exist (witnessed by solve search).");
        solveProof.steps?.slice(0, 30).forEach((line) => steps.push(String(line)));
      } else {
        steps.push("Constraint holds.");
      }
      steps.push(`Objective: ${describeObjective(command.objective)}.`);
      steps.push(`Value: ${String(value)}.`);
      return {
        kind: "OptimizeResult",
        status: "ok",
        value,
        proof: {
          kind: "ProofTrace",
          mode: solveProof ? "SolveSearch" : "Derivation",
          conclusion: "optimization",
          answerSummary: `value=${String(value)}`,
          steps,
          premises: solveProof?.premises ?? [],
        },
      };
    }
    default:
      return { error: `Unsupported command: ${command.kind}` };
  }
}

export function executeProgram(program, state, options = {}) {
  const projectEntityAttributes = options.projectEntityAttributes ?? state?.projectEntityAttributes ?? false;

  if (!program || program.kind !== "Program") {
    return { error: runtimeError("SES030", "executeProgram expects a Program AST.", "Program") };
  }

  if (!state) {
    return { error: runtimeError("SES031", "executeProgram requires an existing compiler/runtime state.", "state") };
  }

  const results = [];
  let currentContext = null;

  for (const item of program.items || []) {
    if (item.kind === "ContextDirective") {
      currentContext = item.name;
      continue;
    }

    if (currentContext === "BaseDictionary") {
      applyDictionaryStatement(item, state.dictionary);
      if (state.dictionary.errors.length > 0) {
        state.errors.push(...state.dictionary.errors);
        state.dictionary.errors.length = 0;
      }
      if (state.errors.length > 0) {
        return { kind: "ProgramResult", results, errors: state.errors.slice() };
      }
      continue;
    }

    if (item.kind === "CommandStatement") {
      if (options.deduce ?? true) {
        materializeRules(state, { justificationStore: state.justificationStore });
      }
      const out = executeCommandAst(item.command, state);
      results.push({ kind: "CommandResult", command: item.command, result: out });
      if (out?.error) {
        return { kind: "ProgramResult", results, errors: [out.error] };
      }
      continue;
    }

    // Compile non-command items incrementally by delegating to the compiler sentence handler.
    // We keep this local to preserve sequential semantics (statements that appear after a command
    // must not affect earlier command results).
    const miniProgram = {
      kind: "Program",
      items: [item],
    };
    compileProgram(miniProgram, { state, projectEntityAttributes });
    if (state.errors.length > 0) {
      return { kind: "ProgramResult", results, errors: state.errors.slice() };
    }
  }

  return { kind: "ProgramResult", results, errors: [] };
}
