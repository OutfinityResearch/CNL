export function createProgram(items) {
  return { kind: "Program", items };
}

export function createStatement(sentence) {
  return { kind: "Statement", sentence };
}
