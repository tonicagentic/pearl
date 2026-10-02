import type { Metadata } from "next";
import { Suspense } from "react";

import { ensureDefaultAreas, listAreas } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { AreaMindmap } from "./areas-mindmap";

export const metadata: Metadata = {
  title: "Areas",
};

/**
 * Areas as a full-canvas mind map. The nested list editor is gone — the
 * canvas is the only surface: drag from a node to add a child, click to
 * rename, Backspace to delete.
 */
export default function AreasPage() {
  return (
    <div className="relative min-h-0 flex-1">
      <Suspense
        fallback={
          <p className="px-4 pt-14 text-sm text-muted-foreground">
            Loading areas…
          </p>
        }
      >
        <ResolvedAreas />
      </Suspense>
    </div>
  );
}

async function ResolvedAreas() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <p className="px-4 pt-14 text-sm text-muted-foreground">
        Sign in with durable storage configured to manage areas.
      </p>
    );
  }

  await ensureDefaultAreas(viewer.id);
  const tree = await listAreas(viewer.id);

  return <AreaMindmap tree={tree} />;
}
