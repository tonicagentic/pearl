"use server";

import { revalidatePath } from "next/cache";

import {
  addCustomAgentMemory,
  deleteCustomAgentMemory,
  deleteCustomAgentRoutine,
  deleteCustomAgentSkill,
  getCustomAgentConfig,
  setCustomAgentIntegrations,
  updateCustomAgentMemory,
  upsertCustomAgentRoutine,
  upsertCustomAgentSkill,
} from "@/lib/custom-agents/config";
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

function revalidate(agentId: string) {
  revalidatePath("/agents");
  revalidatePath(`/chat`);
}

export async function getCustomAgentConfigAction(agentId: string) {
  const viewer = await requireDatabaseViewer();
  const config = await getCustomAgentConfig(viewer.id, agentId);
  if (!config) throw new Error("Unknown agent.");
  return config;
}

export async function addCustomAgentMemoryAction(input: {
  readonly agentId: string;
  readonly text: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await addCustomAgentMemory(
    viewer.id,
    input.agentId,
    input.text,
  );
  revalidate(input.agentId);
  return row;
}

export async function updateCustomAgentMemoryAction(input: {
  readonly agentId: string;
  readonly memoryId: string;
  readonly text: string;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await updateCustomAgentMemory(
    viewer.id,
    input.agentId,
    input.memoryId,
    input.text,
  );
  if (!row) throw new Error("Unknown memory.");
  revalidate(input.agentId);
  return row;
}

export async function deleteCustomAgentMemoryAction(input: {
  readonly agentId: string;
  readonly memoryId: string;
}) {
  const viewer = await requireDatabaseViewer();
  await deleteCustomAgentMemory(viewer.id, input.agentId, input.memoryId);
  revalidate(input.agentId);
  return { ok: true as const };
}

export async function upsertCustomAgentSkillAction(input: {
  readonly agentId: string;
  readonly id?: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
  readonly enabled?: boolean;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await upsertCustomAgentSkill(viewer.id, input.agentId, input);
  revalidate(input.agentId);
  return row;
}

export async function deleteCustomAgentSkillAction(input: {
  readonly agentId: string;
  readonly skillId: string;
}) {
  const viewer = await requireDatabaseViewer();
  await deleteCustomAgentSkill(viewer.id, input.agentId, input.skillId);
  revalidate(input.agentId);
  return { ok: true as const };
}

export async function upsertCustomAgentRoutineAction(input: {
  readonly agentId: string;
  readonly id?: string;
  readonly name: string;
  readonly cron: string;
  readonly timezone?: string;
  readonly prompt: string;
  readonly enabled?: boolean;
}) {
  const viewer = await requireDatabaseViewer();
  const row = await upsertCustomAgentRoutine(viewer.id, input.agentId, input);
  revalidate(input.agentId);
  return row;
}

export async function deleteCustomAgentRoutineAction(input: {
  readonly agentId: string;
  readonly routineId: string;
}) {
  const viewer = await requireDatabaseViewer();
  await deleteCustomAgentRoutine(viewer.id, input.agentId, input.routineId);
  revalidate(input.agentId);
  return { ok: true as const };
}

export async function setCustomAgentIntegrationsAction(input: {
  readonly agentId: string;
  readonly connectionIds: readonly string[];
}) {
  const viewer = await requireDatabaseViewer();
  const rows = await setCustomAgentIntegrations(
    viewer.id,
    input.agentId,
    input.connectionIds,
  );
  revalidate(input.agentId);
  return rows;
}
