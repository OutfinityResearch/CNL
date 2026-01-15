import { collectEntities, collectVariables, emptySet, fullSet, runtimeError } from "./helpers.mjs";
import { evaluateCondition } from "./evaluate.mjs";
import { buildSolveConstraints } from "./solver/constraints.mjs";
import { propagateDomains } from "./solver/propagation.mjs";
import { searchSolveSolutions } from "./solver/search.mjs";
import { collectSolvePremises } from "./solver/results.mjs";

export function solveWithVariables(command, state) {
  const solveLimits = state?.limits?.solve ?? {};

  const requested = [];
  if (Array.isArray(command.variables) && command.variables.length > 0) {
    command.variables.forEach((v) => requested.push(v.name));
  } else if (command.expr?.kind === "Variable") {
    requested.push(command.expr.name);
  }

  const constraintVars = new Set();
  collectVariables(command.constraint, constraintVars);
  if (constraintVars.size > 0 && requested.length === 0) {
    return { error: runtimeError("SES020", "Solve with variables requires a variable target.", "Solve") };
  }

  const allVariables = new Set(requested);
  const { constraints, groundChecks, errors } = buildSolveConstraints(command.constraint, state, allVariables);
  if (errors.length > 0) {
    return { error: errors[0] };
  }

  for (const check of groundChecks) {
    if (!evaluateCondition(check, state)) {
      return { kind: "SolveResult", entities: [], bindings: {} };
    }
  }

  const kbState = state.kb.kb;
  const domains = new Map();
  allVariables.forEach((name) => {
    domains.set(name, fullSet(kbState));
  });

  const initial = propagateDomains(domains, constraints, kbState, solveLimits);
  if (!initial.ok) {
    return {
      kind: "SolveResult",
      entities: [],
      bindings: {},
      proof: {
        kind: "ProofTrace",
        mode: "SolveSearch",
        conclusion: "constraint solving",
        answerSummary: "unsatisfied",
        steps: [`Contradiction: empty domain for ?${initial.contradiction}.`],
        premises: [],
      },
    };
  }

  const outputVars = requested.length > 0 ? requested : Array.from(allVariables);
  const variables = Array.from(allVariables).sort();
  const needsSearch = variables.length > 1;

  if (!needsSearch) {
    const bindings = {};
    outputVars.forEach((name) => {
      bindings[`?${name}`] = collectEntities(domains.get(name) ?? emptySet(kbState), state);
    });
    const onlyEntities = requested.length === 1 ? bindings[`?${requested[0]}`] ?? [] : [];
    return {
      kind: "SolveResult",
      entities: onlyEntities,
      bindings,
      proof: {
        kind: "ProofTrace",
        mode: "Witness",
        conclusion: "solution domain",
        answerSummary: `count=${onlyEntities.length}`,
        steps: [`Returned ${onlyEntities.length} result(s).`],
        premises: [],
      },
    };
  }

  const { solutions, steps } = searchSolveSolutions(domains, constraints, state, variables, solveLimits);

  const bindings = {};
  outputVars.forEach((name) => {
    bindings[`?${name}`] = [];
  });

  const bindingIds = new Map();
  outputVars.forEach((name) => bindingIds.set(name, new Set()));
  for (const sol of solutions) {
    for (const name of outputVars) {
      const id = sol[name];
      if (Number.isInteger(id)) bindingIds.get(name).add(id);
    }
  }

  outputVars.forEach((name) => {
    const set = emptySet(kbState);
    for (const id of bindingIds.get(name)) set.setBit(id);
    bindings[`?${name}`] = collectEntities(set, state);
  });

  const onlyEntities = requested.length === 1 ? bindings[`?${requested[0]}`] ?? [] : [];
  const premises = collectSolvePremises(solutions, constraints, state, solveLimits);

  return {
    kind: "SolveResult",
    entities: onlyEntities,
    bindings,
    solutions,
    proof: {
      kind: "ProofTrace",
      mode: "SolveSearch",
      conclusion: "constraint solving",
      answerSummary: `solutions=${solutions.length}`,
      steps,
      premises,
    },
  };
}

