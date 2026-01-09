export const DEMO_SUITE = [
  {
    id: "demo_basics",
    title: "Basic Reasoning & Transitivity",
    description: "Demonstrates inheritance (is-a) and property propagation.",
    theory: `
John is a User.
User is a Role.
If someone is a User, then they are Active.
If X is a Role, then X is a Concept.
    `,
    steps: [
      {
        command: "Verify that John is a User.",
        expected: "true"
      },
      {
        command: "Verify that John is Active.",
        expected: "true",
        explanation: "Derived via rule: User -> Active"
      },
      {
        command: "Verify that User is a Concept.",
        expected: "true",
        explanation: "Derived via rule: Role -> Concept"
      },
      {
        command: "Explain why John is Active.",
        expectedMatches: ["John is Active because", "John is a User"]
      }
    ]
  },
  {
    id: "demo_relations",
    title: "Relationships & Inverse Lookup",
    description: "Binary relations and bidirectional querying.",
    theory: `
Server-A hosts Database-1.
Server-B hosts Database-2.
Admin manages Server-A.
    `,
    steps: [
      {
        command: "Return the name of every server that hosts Database-1.",
        expected: '["Server-A"]'
      },
      {
        command: "Return the name of every database that Server-B hosts.",
        expected: '["Database-2"]'
      },
      {
        command: "Verify that Admin manages Server-A.",
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
No Admin is a Guest.
Alice is an Admin.
Bob is a Guest.
    `,
    steps: [
      {
        command: "Verify that Alice is a Guest.",
        expected: "false"
      },
      {
        command: "Verify that Bob is an Admin.",
        expected: "false"
      },
      {
        command: "Verify that Alice is a User.",
        expected: "true"
      }
    ]
  }
];
