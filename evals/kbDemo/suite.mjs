export const DEMO_SUITE = [
  {
    id: "demo_basics",
    title: "Basic Reasoning",
    description: "Unary facts plus universal propagation.",
    theory: `
John is a programmer.
Every programmer is a developer.
Every developer is a user.
Every user is active.
Every user that is active is a concept.
    `,
    steps: [
      { command: "Verify that John is a user.", expected: "true" },
      { command: "Verify that John is active.", expected: "true" },
      { command: "Verify that John is a concept.", expected: "true" },
      { command: "Explain why John is a concept.", expectedMatches: ["Derived"] },
    ],
  },
  {
    id: "demo_relations",
    title: "Relationships",
    description: "Binary relations and return queries.",
    theory: `
Server_A is a machine.
Server_B is a machine.
Database_1 is a database.
Database_2 is a database.
Server_A runs Database_1.
Server_B runs Database_2.
Admin is a team_lead.
Admin supervises Server_A.
Every team_lead is a supervisor.
Every machine that runs Database_1 hosts Database_1.
Every machine that runs Database_2 hosts Database_2.
Every machine that hosts a database is a server.
Every supervisor that supervises Server_A manages Server_A.
    `,
    steps: [
      {
        command: "Return the name of every server that hosts Database_1.",
        expected: "Server_A",
      },
      {
        command: "Verify that Server_B hosts Database_2.",
        expected: "true",
      },
      {
        command: "Verify that Admin manages Server_A.",
        expected: "true",
      },
    ],
  },
  {
    id: "demo_negation",
    title: "Negative Proofs",
    description: "False proofs from missing facts.",
    theory: `
Alice is a manager.
Bob is a trainee.
Every manager is a lead.
Every lead is an admin.
Every admin is a user.
Every trainee is a guest.
Every guest is a user.
    `,
    steps: [
      { command: "Verify that Alice is a guest.", expected: "false" },
      { command: "Verify that Bob is an admin.", expected: "false" },
      { command: "Verify that Alice is a user.", expected: "true" },
    ],
  },
  {
    id: "demo_syllogism",
    title: "Syllogism",
    description: "Classic rule-based inference.",
    theory: `
Socrates is a human.
Every human is a man.
Every man is mortal.
    `,
    steps: [
      { command: "Verify that Socrates is mortal.", expected: "true" },
      { command: "Explain why Socrates is mortal.", expectedMatches: ["Derived"] },
    ],
  },
];
