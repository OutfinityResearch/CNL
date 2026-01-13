import { executeSet } from "../../plans/execute.mjs";
import { compileCommand, compileNP } from "../../compiler/ast-to-plan.mjs";
import {
  collectEntities,
  collectVariables,
  hasVariables,
  isNameProjection,
  runtimeError,
} from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { solveWithVariables } from "./solver.mjs";
import { planWithActions } from "./plan.mjs";
import { simulateTransitions } from "./simulate.mjs";
import { evaluateAggregation } from "./optimize.mjs";
import { explainAssertion } from "./explain.mjs";
import { buildProofTraceForVerify } from "./proof-traces.mjs";
import { buildWitnessTraceForSet } from "./witness-traces.mjs";

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
      const ok = evaluateCondition(command.proposition, state);
      return { kind: "ProofResult", value: ok, proof: buildProofTraceForVerify(command, state, ok) };
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
      if (constraintVars.size > 0) {
        const variables = Array.from(constraintVars, (name) => ({ kind: "Variable", name }));
        const solveResult = solveWithVariables({ ...command, variables, expr: null }, state);
        if (solveResult?.error) return solveResult;
        const hasAny = Object.values(solveResult.bindings ?? {}).some((list) => list.length > 0);
        if (!hasAny) {
          return { kind: "OptimizeResult", status: "unsatisfied", value: Number.NaN };
        }
      } else {
        const ok = evaluateCondition(command.constraint, state);
        if (!ok) {
          return { kind: "OptimizeResult", status: "unsatisfied", value: Number.NaN };
        }
      }
      let value = Number.NaN;
      if (command.objective?.kind === "AggregationExpr") {
        value = evaluateAggregation(command.objective, state);
      } else if (command.objective?.kind === "NumberLiteral") {
        value = command.objective.value;
      }
      return { kind: "OptimizeResult", status: "ok", value };
    }
    default:
      return { error: `Unsupported command: ${command.kind}` };
  }
}

export function executeProgram(program) {
  void program;
  throw new Error("Not implemented");
}
