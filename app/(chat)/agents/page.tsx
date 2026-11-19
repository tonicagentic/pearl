import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { listCustomAgents } from "@/lib/custom-agents/store";
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Named Pearl teammates with standing instructions and a single
              durable thread. Separate from Connected agents under Settings.
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

  const agents = await listCustomAgents(viewer.id);

  return (
    <>
      <CreateAgentForm />
      {agents.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No agents yet. Create one to keep a lasting role in one thread.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {agents.map((row) => (
            <li key={row.id}>
              <Link
                className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40"
                href={`/chat/${row.chatId}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AgentAccentMark accent={row.accent} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {row.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.instructions.trim()
                        ? row.instructions.trim().slice(0, 120)
                        : "No instructions yet"}
                    </div>
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
