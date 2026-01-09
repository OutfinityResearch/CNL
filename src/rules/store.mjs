export function createRuleStore() {
  const rules = [];

  function addRule(plan) {
    const id = rules.length;
    rules.push(plan);
    return id;
  }

  function getRules() {
    return rules.slice();
  }

  return {
    addRule,
    getRules,
  };
}
