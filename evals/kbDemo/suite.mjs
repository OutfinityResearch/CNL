export const DEMO_SUITE = [
  {
    id: "demo_syllogism",
    title: "Classic Syllogism",
    description: "Aristotelian logic: All men are mortal.",
    theory: `
Socrates is a Man.
If someone is a Man, then they are Mortal.
    `,
    steps: [
      {
        command: "Verify that Socrates is Mortal.",
        expected: "true",
        explanation: "Inference: Man -> Mortal"
      },
      {
        command: "Explain why Socrates is Mortal.",
        expectedMatches: ["Socrates is a Man"]
      }
    ]
  },
  {
    id: "demo_basics",
    title: "Basic Reasoning",
    description: "Unary facts plus universal propagation.",
    theory: `
John is a user.
Every user is active.
Every user that is active is a concept.
    `,
    steps: [
      { command: "Verify that John is a user.", expected: "true" },
      { command: "Verify that John is active.", expected: "true" },
      { command: "Verify that John is a concept.", expected: "true" }
    ]
  },
  {
    id: "demo_relations",
    title: "Relationships",
    description: "Binary relations and bidirectional queries.",
    theory: `
Server_A hosts Database_1.
Server_B hosts Database_2.
Admin manages Server_A.
    `,
    steps: [
      {
        command: "Return the name of every server that hosts Database_1.",
        expected: '["Server_A"]'
      },
      {
        command: "Return the name of every database that Server_B hosts.",
        expected: '["Database_2"]'
      },
      {
        command: "Verify that Admin manages Server_A.",
        expected: "true"
      }
    ]
  },
  {
    id: "demo_negation",
    title: "Negation & Conflicts",
    description: "Explicit negation and disjoint sets.",
    theory: `
Admin is a User.
Guest is a User.
If someone is an Admin, then they are a NonGuest.
Alice is an Admin.
Bob is a Guest.
    `,
    steps: [
      { command: "Verify that Alice is a NonGuest.", expected: "true" },
      { command: "Verify that Bob is an Admin.", expected: "false" }
    ]
  },
  {
    id: "demo_modal",
    title: "Modal Logic (Simulated)",
    description: "Modeling beliefs and possibilities using reified facts.",
    theory: `
Bob believes Fact_1.
Fact_1 asserts FlatEarth.
Alice believes Fact_2.
Fact_2 asserts RoundEarth.
If X believes F and F asserts P, then P is a Belief of X.
    `,
    steps: [
      { command: "Verify that Bob believes Fact_1.", expected: "true" },
      { command: "Verify that FlatEarth is a Belief of Bob.", expected: "true (Derived)" }
    ]
  },
  {
    id: "demo_fuzzy",
    title: "Fuzzy Logic (Thresholds)",
    description: "Reasoning with continuous values using numeric attributes.",
    theory: `
Thermostat has Temperature 0.85.
Water has Temperature 0.4.
If X has Temperature T and T is greater than 0.7, then X is Hot.
If X has Temperature T and T is less than 0.5, then X is Cold.
    `,
    steps: [
      { command: "Verify that Thermostat is Hot.", expected: "true" },
      { command: "Verify that Water is Cold.", expected: "true" }
    ]
  },
  {
    id: "demo_simulate",
    title: "Simulation (State Machine)",
    description: "Modeling time and state transitions.",
    theory: `
TrafficLight is Red.
If TrafficLight is Red, then NextState is Green.
Action Step: changes TrafficLight to NextState.
    `,
    steps: [
      {
        command: "Simulate for 3 steps.",
        expected: "Trace: Red -> Green -> Yellow -> Red"
      }
    ]
  },
  {
    id: "demo_plan",
    title: "Planning (Goal Seeking)",
    description: "Generating a sequence of actions to reach a goal state.",
    theory: `
Robot is located_at Home.
Package is located_at Warehouse.
Action Move(From, To) requires Robot is located_at From, causes Robot is located_at To.
    `,
    steps: [
      { command: "Plan to achieve Robot has Package.", expected: "[Move(Home, Warehouse), ...]" }
    ]
  },
  {
    id: "demo_solve",
    title: "Constraint Solving (CSP)",
    description: "Finding valid assignments for variables.",
    theory: `
A is a Region. B is a Region.
A touches B.
Red is a Color. Blue is a Color.
Region has Color.
If X touches Y and X has Color C and Y has Color C, then a Conflict exists.
    `,
    steps: [
      { command: "Solve for Color.", expected: "A=Red, B=Blue" }
    ]
  }
];
