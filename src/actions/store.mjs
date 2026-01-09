export function createActionStore() {
  const actions = [];

  function addAction(plan) {
    const id = actions.length;
    actions.push(plan);
    return id;
  }

  function getActions() {
    return actions.slice();
  }

  return {
    addAction,
    getActions,
  };
}
