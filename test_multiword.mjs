import { parseProgram } from "./src/parser/grammar.mjs";

// Test multi-word NP core
const tests = [
  "A critical server is online.",
  "The heavy truck is loaded.",
  "Every active user is logged in.",
  "A red car is parked.",
];

for (const input of tests) {
  try {
    const ast = parseProgram(input);
    const sentence = ast.items[0].sentence;
    const subject = sentence.assertion.subject;
    console.log(`Input: "${input}"`);
    console.log(`  Subject kind: ${subject.kind}`);
    if (subject.kind === "NounPhrase") {
      console.log(`  Core: ${subject.core.join(" ")}`);
      console.log(`  Core words: ${subject.core.length}`);
    }
    console.log();
  } catch (error) {
    console.log(`Input: "${input}"`);
    console.log(`  Error: ${error.message}`);
    console.log();
  }
}