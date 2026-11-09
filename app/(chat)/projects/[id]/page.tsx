import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import {
  getProject,
  listPlans,
  listProjectChats,
} from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { ProjectWorkspace } from "./project-workspace";

export const metadata: Metadata = {
  title: "Project",
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading project…</p>
            }
          >
            <ResolvedProject params={params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ResolvedProject({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer || setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Sign in with durable storage configured to manage projects.
      </p>
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const owned = await getProject(viewer.id, projectId);
  if (!owned) notFound();

  const [plans, chats] = await Promise.all([
    listPlans(viewer.id, owned.id),
    listProjectChats(viewer.id, owned.id),
  ]);

  return (
    <>
      <div className="text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/projects">
          Projects
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{owned.name}</span>
      </div>
      <ProjectWorkspace
        chats={chats.map((row) => ({
          id: row.id,
          title: row.title,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        plans={plans.map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        project={{
          id: owned.id,
          name: owned.name,
          instructions: owned.instructions,
        }}
      />
    </>
  );
}
