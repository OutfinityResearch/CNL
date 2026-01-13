export function materializeRules(state, options = {}) {
  return state.ruleStore.applyRules(state.kb, { ...options, delta: true });
}
