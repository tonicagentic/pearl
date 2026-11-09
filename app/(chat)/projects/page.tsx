import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import { listProjects } from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { CreateProjectForm } from "./create-project-form";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Workspaces that outlive one chat: shared instructions, plans, and
              related conversations. Separate from Areas.
            </p>
          </header>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading projects…</p>
            }
          >
            <ResolvedProjects />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ResolvedProjects() {
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

  const projects = await listProjects(viewer.id);

  return (
    <>
      <CreateProjectForm />
      {projects.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No projects yet. Create one to keep plans and related chats together.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {projects.map((row) => (
            <li key={row.id}>
              <Link
                className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40"
                href={`/projects/${row.id}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.instructions.trim()
                      ? row.instructions.trim().slice(0, 120)
                      : "No instructions yet"}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
