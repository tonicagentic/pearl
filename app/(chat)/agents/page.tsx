import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { listCustomAgents } from "@/lib/custom-agents/store";
import { listProjects } from "@/lib/db/projects";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { CreateAgentForm } from "./create-agent-form";

export const metadata: Metadata = {
  title: "Agents",
};

export default function AgentsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header>
            <h1 className="text-lg font-semibold">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Durable teammates scoped to a project. Each project has a manager;
              add more from Library → Templates. Separate from Connected agents
              under Settings.
            </p>
          </header>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading agents…</p>
            }
          >
            <ResolvedAgents />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function ResolvedAgents() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer || setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Sign in with durable storage configured to manage agents.
      </p>
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const [agents, projects] = await Promise.all([
    listCustomAgents(viewer.id),
    listProjects(viewer.id),
  ]);

  type AgentRow = (typeof agents)[number];
  const byProject = new Map<
    string,
    { name: string; agents: AgentRow[] }
  >();
  for (const project of projects) {
    byProject.set(project.id, { name: project.name, agents: [] });
  }
  for (const agent of agents) {
    const bucket = byProject.get(agent.projectId);
    if (bucket) {
      bucket.agents.push(agent);
    } else {
      byProject.set(agent.projectId, {
        name: agent.projectName ?? "Project",
        agents: [agent],
      });
    }
  }

  const groups = [...byProject.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Your agents</h2>
        <CreateAgentForm
          projects={projects.map((row) => ({ id: row.id, name: row.name }))}
        />
        {agents.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            No agents yet. Create a project (it gets a manager), then add more
            here or from Library → Templates.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(([projectId, group]) =>
              group.agents.length === 0 ? null : (
                <div key={projectId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.name}
                    </h3>
                    <Link
                      className="text-xs text-muted-foreground hover:text-foreground"
                      href={`/projects/${projectId}`}
                    >
                      Open project
                    </Link>
                  </div>
                  <ul className="divide-y rounded-lg border bg-card">
                    {group.agents.map((row) => (
                      <li key={row.id}>
                        <Link
                          className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40"
                          href={`/chat/${row.chatId}`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AgentAccentMark
                              accent={row.accent}
                              markShape={row.markShape}
                              markTalk={row.markTalk}
                              markBrows={row.markBrows}
                              markGaze={row.markGaze}
                              size="md"
                              motion="off"
                              eyeMotion="off"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {row.name}
                                {row.role === "manager" ? (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    Manager
                                  </span>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {row.instructions.trim()
                                  ? row.instructions.trim().slice(0, 120)
                                  : "No instructions yet"}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Open
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Browse ready-made roles in{" "}
        <Link className="underline underline-offset-2" href="/library">
          Library → Templates
        </Link>
        .
      </p>
    </>
  );
}
