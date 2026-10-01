/**
 * The sync layer between the interactive mind map (whose nodes carry the
 * areas' database ids) and the server actions.
 *
 * The mind map reports its full data after every edit; this module diffs the
 * authoritative area tree against the new map data and produces the minimal
 * list of server actions to apply. Nodes keep their ids across edits (the
 * map preserves them; new nodes get generated ids), so diffs are exact —
 * no name matching.
 */

export type MindmapSyncNode = {
  readonly id: string;
  readonly text: string;
  readonly children?: readonly MindmapSyncNode[];
};

export type AreaSyncNode = {
  readonly id: string;
  readonly name: string;
  readonly children: readonly AreaSyncNode[];
};

export type MindmapChange =
  | { kind: "rename"; id: string; name: string }
  | { kind: "create"; name: string; parentId: string | null }
  | { kind: "delete"; id: string }
  | {
      kind: "move";
      id: string;
      parentId: string | null;
      sortIndex: number;
    };

type FlatEntry = { parentId: string | null; index: number; name: string };

function flatten<T extends { id?: string; text?: string; name?: string; children?: readonly T[] }>(
  nodes: readonly T[],
  parentKey: string | null,
  into: Map<string, FlatEntry>,
): void {
  nodes.forEach((node, index) => {
    const id = String(node.id ?? "");
    if (id) {
      into.set(id, {
        parentId: parentKey,
        index,
        name: String(node.name ?? node.text ?? ""),
      });
    }
    const children = (node.children ?? []) as readonly T[];
    flatten(children, id || parentKey, into);
  });
}

/**
 * Diff the authoritative tree against the map's new data. Order of the
 * result: deletes, renames, moves, creates — creates last so a newly created
 * parent can receive children from the same edit batch.
 */
export function diffAreaTrees(
  before: readonly AreaSyncNode[],
  after: readonly MindmapSyncNode[],
): MindmapChange[] {
  const beforeById = new Map<string, FlatEntry>();
  const afterById = new Map<string, FlatEntry>();
  flatten(before, null, beforeById);
  flatten(after, null, afterById);

  const changes: MindmapChange[] = [];

  for (const [id, beforeEntry] of beforeById) {
    const afterEntry = afterById.get(id);
    if (!afterEntry) {
      changes.push({ kind: "delete", id });
    } else if (afterEntry.name !== beforeEntry.name) {
      changes.push({ kind: "rename", id, name: afterEntry.name });
    } else if (
      afterEntry.parentId !== beforeEntry.parentId ||
      afterEntry.index !== beforeEntry.index
    ) {
      changes.push({
        kind: "move",
        id,
        parentId: afterEntry.parentId,
        sortIndex: afterEntry.index,
      });
    }
  }

  for (const [id, afterEntry] of afterById) {
    if (!beforeById.has(id)) {
      changes.push({
        kind: "create",
        name: afterEntry.name,
        parentId: afterEntry.parentId,
      });
    }
  }

  // A move of a whole subtree also moves the ids of its descendants (their
  // parent ids change); skip the implicit descendant moves of anything
  // already moving as a subtree root — the server moves the whole subtree.
  const movedSubtreeRoots = new Set(
    changes.filter((c) => c.kind === "move").map((c) => c.id),
  );
  return changes.filter((change) => {
    if (change.kind !== "move") {
      return true;
    }
    // Drop descendant moves whose ancestor is also moving: walk the before
    // tree via parent links.
    let parent = change.parentId;
    while (parent) {
      if (movedSubtreeRoots.has(parent)) {
        return false;
      }
      parent = afterById.get(parent)?.parentId ?? null;
      if (parent && movedSubtreeRoots.has(parent)) {
        return false;
      }
    }
    return true;
  });
}
