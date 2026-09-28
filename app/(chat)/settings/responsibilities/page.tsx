import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  ensureDefaultResponsibilities,
  listResponsibilities,
} from "@/lib/db/issues";
import type { ResponsibilityNode } from "@/lib/db/issues";
import { getSetupStatus } from "@/lib/setup";
import { getServerViewer } from "@/lib/session";

import { ResponsibilityMindmap } from "./responsibility-mindmap";
import { ResponsibilityNodeEditor } from "./responsibility-node-editor";

export const metadata: Metadata = {
  title: "Responsibilities",
};

/**
 * The responsibility tree: the enduring structure of the user's life. The
 * structure is just parentId; v1 renders a nested list (no canvas). The
 * default tree is seeded idempotently on first visit — responsibilities are
 * never empty, so issues always have a home.
 */
export default function ResponsibilitiesPage() {
  return (
    // Page frame: the shell's main is overflow-hidden (the chat scrolls
    // internally), so non-chat pages own their scroll here.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Suspense
            fallback={
              <p className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
                Loading responsibilities…
              </p>
            }
          >
            <ResolvedResponsibilities />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ResolvedResponsibilities() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
        Sign in with durable storage configured to manage responsibilities.
      </p>
    );
  }

  const tree = await (async () => {
    await ensureDefaultResponsibilities(viewer.id);
    return listResponsibilities(viewer.id);
  })();

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Responsibilities</h1>
        <p className="text-sm text-muted-foreground">
          The stable areas of your life. They are never “done” — issues come
          and go underneath them. See them on the{" "}
          <Link href="/issues" className="underline">
            issues inbox
          </Link>
          .
        </p>
      </header>
      <ResponsibilityMindmap tree={tree} />
      <div className="flex flex-col gap-1">
        {tree.map((node) => (
          <ResponsibilityNodeEditor key={node.id} node={node} depth={0} />
        ))}
      </div>
    </>
  );
}
