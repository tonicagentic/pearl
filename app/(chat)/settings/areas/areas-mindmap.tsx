"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MindMap, type MindMapData, type MindMapRef } from "@xiangfa/mindmap";
import "@xiangfa/mindmap/style.css";
import { useRouter } from "next/navigation";
import {
  createAreaAction,
  deleteAreaAction,
  moveAreaAction,
  renameAreaAction,
} from "@/app/actions/issues";
import type { AreaNode } from "@/lib/db/issues";
import { diffAreaTrees, type MindmapChange } from "@/lib/areas-mindmap-sync";

/**
 * The interactive areas mind map, backed by @xiangfa/mindmap (drag to
 * reorganize, click to edit inline, keyboard shortcuts, pan/zoom), themed
 * by the library's own light/dark tokens ("auto" follows uniwind).
 *
 * The projection is ID-based: each mind-map node carries the area's DB id,
 * so onDataChange diffs resolve to exact server actions — rename, create,
 * move, delete — instead of name matching. A failed server call (e.g. the
 * delete guard blocking an area with open issues) resets the map to the
 * authoritative tree and surfaces the error.
 */

export function AreaMindmap({ tree }: { readonly tree: readonly AreaNode[] }) {
  const router = useRouter();
  const mindmapRef = useRef<MindMapRef>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // The authoritative projection: after every server refresh (or a failed
  // sync) the map is reset to exactly this.
  const projected = useRef<string>("");
  const toMindMapData = useCallback(
    (nodes: readonly AreaNode[]): MindMapData[] =>
      nodes.map((node) => ({
        id: node.id,
        text: node.name,
        children: toMindMapData(node.children),
      })),
    [],
  );

  const data = useRef<MindMapData[]>(toMindMapData(tree));
  projected.current = JSON.stringify(data.current);

  // Server refreshes (router.refresh() after any edit anywhere on the page)
  // push the new authoritative tree into the map.
  useEffect(() => {
    const next = toMindMapData(tree);
    if (JSON.stringify(next) !== projected.current) {
      projected.current = JSON.stringify(next);
      mindmapRef.current?.setData(next);
    }
  }, [tree, toMindMapData]);

  const applyChanges = useCallback(
    async (changes: readonly MindmapChange[]) => {
      if (changes.length === 0) {
        return;
      }

      setSyncing(true);
      setSyncError(null);
      try {
        // Creates first so later changes can reference new parents.
        for (const change of changes) {
          if (change.kind === "rename") {
            await renameAreaAction(change.id, { name: change.name });
          } else if (change.kind === "create") {
            await createAreaAction({
              name: change.name,
              parentId: change.parentId,
            });
          } else if (change.kind === "move") {
            await moveAreaAction(change.id, {
              parentId: change.parentId,
              sortIndex: change.sortIndex,
            });
          } else {
            await deleteAreaAction(change.id);
          }
        }
      } catch (cause) {
        setSyncError(
          cause instanceof Error
            ? cause.message
            : "The change could not be saved.",
        );
      } finally {
        setSyncing(false);
        // Authoritative refresh: new data resets the map (also undoing any
        // change the server refused).
        router.refresh();
      }
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-2">
      {syncing ? (
        <p className="text-xs text-muted-foreground">Saving…</p>
      ) : null}
      {syncError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {syncError}
        </p>
      ) : null}
      <div className="h-[560px] overflow-hidden rounded-lg border bg-card">
        <MindMap
          ref={mindmapRef}
          data={data.current}
          theme="auto"
          toolbar
          onDataChange={(next) => {
            void applyChanges(diffAreaTrees(tree, next));
          }}
        />
      </div>
    </div>
  );
}
