import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getPlan, getProject } from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = {
  title: "Plan",
};

export default function PlanPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading plan…</p>
            }
          >
            <ResolvedPlan params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ResolvedPlan({
  params,
}: {
  readonly params: Promise<{ id: string; planId: string }>;
}) {
  const { id: projectId, planId } = await params;
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer || setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Sign in with durable storage configured to manage plans.
      </p>
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const owned = await getProject(viewer.id, projectId);
  if (!owned) notFound();

  const row = await getPlan(viewer.id, planId);
  if (!row || row.projectId !== owned.id) notFound();

  return (
    <>
      <div className="text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/projects">
          Projects
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          className="hover:text-foreground"
          href={`/projects/${owned.id}`}
        >
          {owned.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{row.title}</span>
      </div>
      <PlanEditor
        plan={{
          id: row.id,
          projectId: row.projectId,
          title: row.title,
          slug: row.slug,
          markdown: row.markdown,
        }}
      />
    </>
  );
}
