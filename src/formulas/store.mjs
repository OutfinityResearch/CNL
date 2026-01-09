export function createFormulaStore() {
  const formulas = [];

  function addFormula(node) {
    const id = formulas.length;
    formulas.push(node);
    return id;
  }

  function getFormula(id) {
    return formulas[id];
  }

  return {
    addFormula,
    getFormula,
  };
}
