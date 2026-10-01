import { test } from "node:test";
import assert from "node:assert/strict";

import { diffAreaTrees } from "../lib/areas-mindmap-sync.ts";
import type { AreaSyncNode, MindmapSyncNode } from "../lib/areas-mindmap-sync.ts";

function area(id: string, name: string, children: AreaSyncNode[] = []): AreaSyncNode {
  return { id, name, children };
}
function node(id: string, text: string, children: MindmapSyncNode[] = []): MindmapSyncNode {
  return { id, text, children };
}

test("no changes when the map matches the tree", () => {
  const tree = [area("a1", "Body", [area("a2", "Aesthetics")])];
  const map = [node("a1", "Body", [node("a2", "Aesthetics")])];
  assert.deepEqual(diffAreaTrees(tree, map), []);
});

test("rename: same id, different text", () => {
  const tree = [area("a1", "Body")];
  const map = [node("a1", "Wellness")];
  assert.deepEqual(diffAreaTrees(tree, map), [
    { kind: "rename", id: "a1", name: "Wellness" },
  ]);
});

test("create: a new node under an existing parent", () => {
  const tree = [area("a1", "Body")];
  const map = [node("a1", "Body", [node("gen1", "Aesthetics")])];
  assert.deepEqual(diffAreaTrees(tree, map), [
    { kind: "create", name: "Aesthetics", parentId: "a1" },
  ]);
});

test("create: a new top-level area", () => {
  const tree = [area("a1", "Body")];
  const map = [node("a1", "Body"), node("gen1", "Finances")];
  assert.deepEqual(diffAreaTrees(tree, map), [
    { kind: "create", name: "Finances", parentId: null },
  ]);
});

test("delete: a removed node", () => {
  const tree = [area("a1", "Body", [area("a2", "Aesthetics")])];
  const map = [node("a1", "Body")];
  assert.deepEqual(diffAreaTrees(tree, map), [{ kind: "delete", id: "a2" }]);
});

test("move: same id re-parented", () => {
  const tree = [
    area("a1", "Body", [area("a2", "Aesthetics")]),
    area("a3", "Mind"),
  ];
  const map = [
    node("a1", "Body"),
    node("a3", "Mind", [node("a2", "Aesthetics")]),
  ];
  const changes = diffAreaTrees(tree, map);
  const moves = changes.filter((c) => c.kind === "move");
  // a2 moved under a3; its index changed too. The descendant-subtree filter
  // only drops moves beneath a moved subtree root, so this is one move.
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], {
    kind: "move",
    id: "a2",
    parentId: "a3",
    sortIndex: 0,
  });
});

test("move: reorder within the same parent reports a move", () => {
  const tree = [area("a1", "Body"), area("a2", "Mind")];
  const map = [node("a2", "Mind"), node("a1", "Body")];
  const changes = diffAreaTrees(tree, map);
  assert.equal(changes.filter((c) => c.kind === "move").length, 2);
});

test("rename of a subtree root does not spawn descendant changes", () => {
  const tree = [
    area("a1", "Body", [area("a2", "Aesthetics", [area("a3", "Style")])]),
  ];
  const map = [node("a1", "Wellness", [node("a2", "Aesthetics"), node("a9", "Style")])];
  const changes = diffAreaTrees(tree, map);
  // a1 renamed; a2 unchanged; a3's parent path changed but a3 itself was
  // re-created by the edit (new id) → create. Deletes precede creates.
  assert.deepEqual(changes, [
    { kind: "rename", id: "a1", name: "Wellness" },
    { kind: "delete", id: "a3" },
    { kind: "create", name: "Style", parentId: "a1" },
  ]);
});
