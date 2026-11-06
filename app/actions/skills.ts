"use server";

import { revalidatePath } from "next/cache";

import { listUserSkills } from "@/lib/db/skills";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { UserSkill } from "@/lib/db/schema";
import {
  createCustomSkill,
  installPublishedSkill,
  previewPublishedSkill,
  removeSkill,
  searchPublishedSkills,
  setSkillEnabled,
  updateCustomSkill,
  type SkillFormInput,
} from "@/lib/skills/manage";
import type {
  RegistrySearchHit,
  RegistrySkillPackage,
} from "@/lib/skills/registry";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer() {
  const setupStatus = await getSetupStatus();

  if (setupStatus.storageMode !== "database") {
    throw new Error("Database persistence is not enabled.");
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    throw new Error("Sign in to continue.");
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: {
      email: viewer.email,
      name: viewer.name,
    },
  });

  return viewer;
}

function revalidateSkills() {
  revalidatePath("/settings/skills");
}

export type { SkillFormInput };

export async function listSkillsAction(): Promise<readonly UserSkill[]> {
  const viewer = await requireViewer();
  return listUserSkills(viewer.id);
}

export async function createSkillAction(
  input: SkillFormInput,
): Promise<UserSkill> {
  const viewer = await requireViewer();
  const row = await createCustomSkill(viewer.id, input);
  revalidateSkills();
  return row;
}

export async function updateSkillAction(
  id: string,
  input: SkillFormInput,
): Promise<UserSkill> {
  const viewer = await requireViewer();
  const row = await updateCustomSkill(viewer.id, id, input);
  revalidateSkills();
  return row;
}

export async function setSkillEnabledAction(
  id: string,
  enabled: boolean,
): Promise<UserSkill> {
  const viewer = await requireViewer();
  const row = await setSkillEnabled(viewer.id, id, enabled);
  revalidateSkills();
  return row;
}

export async function deleteSkillAction(id: string): Promise<void> {
  const viewer = await requireViewer();
  await removeSkill(viewer.id, id);
  revalidateSkills();
}

export async function searchPublishedSkillsAction(query: string): Promise<{
  readonly items: readonly RegistrySearchHit[];
  readonly total: number;
  readonly hasMore: boolean;
}> {
  await requireViewer();
  return searchPublishedSkills(query);
}

export async function previewPublishedSkillAction(
  registryName: string,
): Promise<RegistrySkillPackage> {
  await requireViewer();
  return previewPublishedSkill(registryName);
}

export async function installPublishedSkillAction(
  registryName: string,
): Promise<UserSkill> {
  const viewer = await requireViewer();
  const row = await installPublishedSkill(viewer.id, registryName);
  revalidateSkills();
  return row;
}
