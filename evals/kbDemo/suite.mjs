export const DEMO_SUITE = [
  {
    id: "demo_syllogism",
    title: "Classic Syllogism",
    description: "Aristotelian logic: All men are mortal.",
    theory: `
	Socrates is a man.
	Every man is mortal.
	    `,
    steps: [
      {
        command: "Verify that Socrates is mortal.",
        expected: "true",
        explanation: "Inference: man -> mortal"
      },
      {
        command: "Verify that it is not the case that Socrates is a god.",
        expected: "true"
      },
      {
        command: "Explain why Socrates is mortal.",
        expectedMatches: ["Socrates is a man"]
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
	Server_A is a server.
	Server_B is a server.
	Database_1 is a database.
	Database_2 is a database.
	Admin_1 is an admin.
	Server_A hosts Database_1.
	Server_B hosts Database_2.
	Database_1 is hosted by Server_A.
	Database_2 is hosted by Server_B.
	Admin_1 manages Server_A.
	    `,
    steps: [
      {
        command: "Return the name of every server that hosts Database_1.",
        expected: '["Server_A"]'
      },
      {
        command: "Return the name of every database that is hosted by Server_B.",
        expected: '["Database_2"]'
      },
      {
        command: "Verify that it is not the case that Admin_1 manages Server_B.",
        expected: "true"
      },
      {
        command: "Verify that Admin_1 manages Server_A.",
        expected: "true"
      }
    ]
  },
  {
    id: "demo_negation",
    title: "Negation & Conflicts",
    description: "Explicit negation and disjoint sets.",
    theory: `
	Every admin is a user.
	Every guest is a user.
	Every admin is a non-guest.
	Alice is an admin.
	Bob is a guest.
    `,
    steps: [
      { command: "Verify that Alice is a non-guest.", expected: "true" },
      { command: "Verify that it is not the case that Bob is an admin.", expected: "true" },
      { command: "Verify that Bob is an admin.", expected: "unknown" }
    ]
  },
  {
    id: "demo_modal",
    title: "Modal Logic (Simulated)",
    description: "Modeling beliefs and possibilities using reified facts.",
    theory: `
Bob believes Claim_1.
Claim_1 asserts flat-earth.
Rule: If ?X believes ?Y and ?Y asserts ?Z, then ?X believes ?Z.
    `,
    steps: [
      { command: "Verify that Bob believes Claim_1.", expected: "true" },
      { command: "Verify that Bob believes flat-earth.", expected: "true" }
    ]
  },
  {
    id: "demo_fuzzy",
    title: "Fuzzy Logic (Thresholds)",
    description: "Reasoning with continuous values using numeric attributes.",
    theory: `
	Thermostat_1 is a device.
	Water_1 is water.
	Water_1 is a liquid.
	Thermostat_1 has a temperature of 0.85.
	Water_1 has a temperature of 0.4.
	Every device whose temperature is greater than 0.7 is hot.
	Every liquid whose temperature is less than 0.5 is cold.
	    `,
    steps: [
      { command: "Verify that Thermostat_1 is hot.", expected: "true" },
      { command: "Verify that it is not the case that Water_1 is hot.", expected: "true" },
      { command: "Verify that Water_1 is cold.", expected: "true" }
    ]
  },
  {
    id: "demo_simulate",
    title: "Simulation (State Machine)",
    description: "Modeling time and state transitions.",
    theory: `
Light_1 is a traffic-light.
Light_1 is red.
When Light_1 is red occurs, then Light_1 is green.
When Light_1 is green occurs, then Light_1 is yellow.
When Light_1 is yellow occurs, then Light_1 is red.
    `,
    steps: [
      {
        command: "Simulate 3 steps.",
        expected: "steps=3"
      }
    ]
  },
  {
    id: "demo_plan",
    title: "Planning (Goal Seeking)",
    description: "Generating a sequence of actions to reach a goal state.",
    theory: `
	Robot_1 is a robot.
	Package_A is a package.
	Home is a location.
	Warehouse is a location.
	Station is a location.
	Robot_1 is located at Home.
	Package_A is located at Warehouse.
	Road_HW is blocked.
	Action: move home to warehouse.
	Agent: a robot.
	Precondition: Robot_1 is located at Home.
	Precondition: it is not the case that Road_HW is blocked.
	Effect: Robot_1 is located at Warehouse.

	Action: move home to station.
	Agent: a robot.
	Precondition: Robot_1 is located at Home.
	Effect: Robot_1 is located at Station.

	Action: move station to warehouse.
	Agent: a robot.
	Precondition: Robot_1 is located at Station.
	Effect: Robot_1 is located at Warehouse.

	Action: pick up package.
	Agent: a robot.
	Precondition: Robot_1 is located at Warehouse.
	Precondition: Package_A is located at Warehouse.
	Effect: Robot_1 carries Package_A.

	Action: move warehouse to home.
	Agent: a robot.
	Precondition: Robot_1 is located at Warehouse.
	Effect: Robot_1 is located at Home.

	Action: deliver package.
	Agent: a robot.
	Precondition: Robot_1 is located at Home.
	Precondition: Robot_1 carries Package_A.
	Effect: Package_A is delivered.
	    `,
    steps: [
      { command: "Verify that it is not the case that Package_A is delivered.", expected: "true" },
      { command: "Verify that Road_HW is blocked.", expected: "true" },
      { command: "Plan to achieve Package_A is delivered.", expected: "satisfied" }
    ]
  },
  {
    id: "demo_solve",
    title: "Constraint Solving (CSP)",
    description: "Finding valid assignments for variables.",
    theory: `
	Region_A is a region.
	Region_B is a region.
	Region_C is a region.
	Region_D is a region.

	red is a color.
	green is a color.
	blue is a color.
	yellow is a color.

	red is a basic-color.
	green is a basic-color.
	blue is a basic-color.

	red is a forbidden-color.

	Rule: If X touches Y, then Y touches X.
	Rule: If X differs-from Y, then Y differs-from X.

	Region_A touches Region_B.
	Region_A touches Region_C.
	Region_A touches Region_D.
	Region_B touches Region_C.
	Region_B touches Region_D.
	Region_C touches Region_D.

	Region_A has-color red.
	Region_A has-color green.
	Region_A has-color blue.
	Region_B has-color red.
	Region_B has-color green.
	Region_B has-color blue.
	Region_C has-color red.
	Region_C has-color green.
	Region_C has-color blue.
	Region_D has-color red.
	Region_D has-color green.
	Region_D has-color blue.
	Region_A has-color yellow.
	Region_B has-color yellow.
	Region_C has-color yellow.
	Region_D has-color yellow.

	red differs-from green.
	red differs-from blue.
	green differs-from blue.
	red differs-from yellow.
	green differs-from yellow.
	blue differs-from yellow.
	    `,
    steps: [
      {
        command:
          "Solve for ?CA such that Region_A has-color ?CA and Region_B has-color ?CB and Region_C has-color ?CC and Region_D has-color ?CD and ?CA is a basic-color and ?CB is a basic-color and ?CC is a basic-color and ?CD is a basic-color and it is not the case that ?CA is a forbidden-color and ?CA differs-from ?CB and ?CA differs-from ?CC and ?CA differs-from ?CD and ?CB differs-from ?CC and ?CB differs-from ?CD and ?CC differs-from ?CD.",
        expected: "[]"
      },
      {
        command:
          "Solve for ?CA such that Region_A has-color ?CA and Region_B has-color ?CB and Region_C has-color ?CC and Region_D has-color ?CD and ?CA is a color and ?CB is a color and ?CC is a color and ?CD is a color and it is not the case that ?CA is a forbidden-color and ?CA differs-from ?CB and ?CA differs-from ?CC and ?CA differs-from ?CD and ?CB differs-from ?CC and ?CB differs-from ?CD and ?CC differs-from ?CD.",
        expected: '["green","blue","yellow"]'
      }
    ]
  }
];
