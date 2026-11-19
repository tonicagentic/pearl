"use server";

import { revalidatePath } from "next/cache";

import {
  createCustomAgent,
  deleteCustomAgent,
  getCustomAgent,
  listCustomAgents,
  updateCustomAgent,
} from "@/lib/custom-agents/store";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireDatabaseViewer() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer || setup.storageMode !== "database") {
    throw new Error("Sign in with durable storage to manage agents.");
  }
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  return viewer;
}

function revalidateAgentPaths(agentId?: string) {
  revalidatePath("/agents");
  if (agentId) {
    revalidatePath(`/agents/${agentId}`);
  }
}

export async function listCustomAgentsAction() {
  const viewer = await requireDatabaseViewer();
  return listCustomAgents(viewer.id);
}

export async function createCustomAgentAction(input: {
  readonly name: string;
  readonly instructions?: string;
  readonly accent?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await createCustomAgent(viewer.id, input);
  revalidateAgentPaths(row.id);
  return row;
}

export async function updateCustomAgentAction(input: {
  readonly agentId: string;
  readonly name?: string;
  readonly instructions?: string;
  readonly accent?: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await updateCustomAgent(viewer.id, input.agentId, input);
  if (!row) throw new Error("Unknown agent.");
  revalidateAgentPaths(row.id);
  return row;
}

export async function deleteCustomAgentAction(input: {
  readonly agentId: string;
}) {
  const viewer = await requireDatabaseViewer();
  const existing = await getCustomAgent(viewer.id, input.agentId);
  if (!existing) throw new Error("Unknown agent.");
  await deleteCustomAgent(viewer.id, input.agentId);
  revalidateAgentPaths(input.agentId);
  return { ok: true as const };
}
