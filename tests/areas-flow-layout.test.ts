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

test("an empty tree is just the root", () => {
  const { nodes, edges } = areasToFlow([]);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.id, AREAS_ROOT_ID);
  assert.equal(edges.length, 0);
});
