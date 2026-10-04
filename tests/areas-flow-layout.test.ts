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
  assert.ok(nodes.every((node) => !Object.hasOwn(node, "parentId")));
  assert.equal(bodyEdge?.source, AREAS_ROOT_ID);
  assert.equal(edges.find((edge) => edge.target === "mind")?.source, AREAS_ROOT_ID);
  assert.equal(aestheticsEdge?.source, "body");
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
    return node.position.y;
  }
  const right = ["a", "b", "career", "home"].map(absoluteY).sort((a, b) => a - b);
  const left = Array.from({ length: 6 }, (_, i) => absoluteY(`m${i}`)).sort((a, b) => a - b);

  assert.ok(Math.abs((right.at(-1)! - right[0]) - (left.at(-1)! - left[0])) < 0.001);
  assert.ok(right[1] - right[0] > 58); // More than the original 40px node + 18px gap.
  assert.ok(right.every((value, index) => index === 0 || value - right[index - 1] >= 58));
  assert.equal(absoluteY("body"), (absoluteY("a") + absoluteY("b")) / 2);
});

test("fourth-generation nodes keep canvas coordinates instead of accumulating parent offsets", () => {
  const { nodes, edges } = areasToFlow([
    {
      id: "activity", name: "Activity", children: [
        { id: "creative", name: "Creative", children: [
          { id: "design", name: "Design", children: [
            { id: "system", name: "System", children: [] },
            { id: "studio", name: "Studio", children: [] },
          ] },
        ] },
      ],
    },
    { id: "mind", name: "Mind", children: [] },
  ]);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  assert.deepEqual(
    ["activity", "creative", "design", "system"].map((id) => byId.get(id)?.position.x),
    [180, 360, 540, 720],
  );
  assert.ok(nodes.every((node) => !Object.hasOwn(node, "parentId")));
  assert.equal(edges.find((edge) => edge.target === "system")?.source, "design");
  assert.equal(byId.get("design")?.position.y, 0);
  assert.ok((byId.get("studio")?.position.y ?? 0) - (byId.get("system")?.position.y ?? 0) >= 58);
});

test("an empty tree is just the root", () => {
  const { nodes, edges } = areasToFlow([]);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.id, AREAS_ROOT_ID);
  assert.equal(edges.length, 0);
});
