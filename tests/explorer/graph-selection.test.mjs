import test from "node:test";
import assert from "node:assert/strict";
import { computeConnectedSubgraph } from "../../tools/explorer/client/app/graph.mjs";

test("computeConnectedSubgraph includes upstream and downstream reachability", () => {
  const edges = [
    { source: "A", target: "B" },
    { source: "B", target: "C" },
    { source: "X", target: "B" },
    { source: "C", target: "D" },
    { source: "D", target: "B" }, // cycle back into B
  ];

  const sel = computeConnectedSubgraph("B", edges);
  assert.equal(sel.start, "B");
  // Upstream: A, X, D, C (through D->B and C->D)
  // Downstream: C, D (and then back to B via D->B)
  ["B", "A", "X", "C", "D"].forEach((n) => assert.ok(sel.nodes.has(n), `missing ${n}`));
  // All edges should be reachable due to cycle
  assert.equal(sel.edges.size, edges.length);
});

