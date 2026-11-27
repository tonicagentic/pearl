import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { listCustomAgents } from "@/lib/custom-agents/store";
import { listAgentTemplates } from "@/lib/custom-agents/templates";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getProject, listProjectChats } from "@/lib/db/projects";
import { listProjectArtifacts } from "@/lib/db/project-artifacts";
import { listProjectPins } from "@/lib/db/workbench-pins";
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

  const [artifacts, chats, pins, agents, templates] = await Promise.all([
    listProjectArtifacts(viewer.id, owned.id),
    listProjectChats(viewer.id, owned.id),
    listProjectPins(viewer.id, owned.id),
    listCustomAgents(viewer.id, { projectId: owned.id }),
    listAgentTemplates(viewer.id, { projectId: owned.id }),
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
        agents={agents.map((row) => ({
          id: row.id,
          name: row.name,
          role: row.role,
          instructions: row.instructions,
          accent: row.accent,
          markShape: row.markShape,
          markTalk: row.markTalk,
          markBrows: row.markBrows,
          markGaze: row.markGaze,
          chatId: row.chatId,
        }))}
        chats={chats.map((row) => ({
          id: row.id,
          title: row.title,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        files={artifacts.map((row) => ({
          id: row.id,
          title: row.title,
          pathname: row.pathname,
          updatedAt: row.createdAt,
        }))}
        pins={pins.map((pin) => ({
          id: pin.id,
          fullName: pin.fullName,
          vercelProjectId: pin.vercelProjectId ?? null,
        }))}
        project={{
          id: owned.id,
          name: owned.name,
          instructions: owned.instructions,
        }}
        templates={templates}
      />
    </>
  );
}
