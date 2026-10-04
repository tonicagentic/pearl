import assert from "node:assert/strict";
import { test } from "node:test";

import { AREAS_ROOT_ID, areasToFlow } from "../lib/areas-flow-layout.ts";

test("fans top-level areas left and right of the root", () => {
  const { nodes, edges } = areasToFlow([
    {
      id: "body",
      name: "Body",
      children: [{ id: "aesthetics", name: "Aesthetics", children: [] }],
    },
    { id: "mind", name: "Mind", children: [] },
  ]);

  const root = nodes.find((node) => node.id === AREAS_ROOT_ID);
  const body = nodes.find((node) => node.id === "body");
  const mind = nodes.find((node) => node.id === "mind");
  const aesthetics = nodes.find((node) => node.id === "aesthetics");
  const bodyEdge = edges.find((edge) => edge.target === "body");
  const aestheticsEdge = edges.find((edge) => edge.target === "aesthetics");

  assert.equal(root?.deletable, false);
  assert.equal(body?.parentId, AREAS_ROOT_ID);
  assert.equal(mind?.parentId, AREAS_ROOT_ID);
  assert.equal(aesthetics?.parentId, "body");
  assert.ok((body?.position.x ?? 0) > 0);
  assert.ok((mind?.position.x ?? 0) < 0);
  assert.equal(Math.sign(aesthetics?.position.x ?? 0), Math.sign(body?.position.x ?? 0));
  assert.equal(bodyEdge?.sourceHandle, "source-right");
  assert.equal(bodyEdge?.targetHandle, "target-left");
  assert.equal(aestheticsEdge?.sourceHandle, "source-right");
  assert.equal(aestheticsEdge?.targetHandle, "target-left");
});

test("the shorter side spreads its branches into the available vertical space", () => {
  const tree = [
    {
      id: "body", name: "Body",
      children: [
        { id: "a", name: "A", children: [] },
        { id: "b", name: "B", children: [] },
      ],
    },
    {
      id: "mind", name: "Mind",
      children: Array.from({ length: 6 }, (_, index) => ({
        id: `m${index}`, name: `M${index}`, children: [],
      })),
    },
    { id: "career", name: "Career", children: [] },
    { id: "home", name: "Home", children: [] },
  ];
  const { nodes } = areasToFlow(tree);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  function absoluteY(id: string): number {
    const node = byId.get(id);
    assert.ok(node);
    return node.position.y + (node.parentId ? absoluteY(node.parentId) : 0);
  }
  const right = ["a", "b", "career", "home"].map(absoluteY).sort((a, b) => a - b);
  const left = Array.from({ length: 6 }, (_, i) => absoluteY(`m${i}`)).sort((a, b) => a - b);

  assert.ok(Math.abs((right.at(-1)! - right[0]) - (left.at(-1)! - left[0])) < 0.001);
  assert.ok(right[1] - right[0] > 58); // More than the original 40px node + 18px gap.
  assert.ok(right.every((value, index) => index === 0 || value - right[index - 1] >= 58));
  assert.equal(absoluteY("body"), (absoluteY("a") + absoluteY("b")) / 2);
});

test("an empty tree is just the root", () => {
  const { nodes, edges } = areasToFlow([]);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.id, AREAS_ROOT_ID);
  assert.equal(edges.length, 0);
});
