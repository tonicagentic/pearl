"use server";

import { revalidatePath } from "next/cache";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getUserProfile, upsertUserProfile } from "@/lib/db/profile";
import {
  compactProfileDto,
  toProfileDto,
  type ProfileDto,
} from "@/lib/profile/serialize";
import type { ProfileFormInput } from "@/lib/profile/validation";
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

function revalidateIdentity() {
  revalidatePath("/settings/identity");
}

export type { ProfileDto, ProfileFormInput };

export async function getProfileAction(): Promise<ProfileDto | null> {
  const viewer = await requireViewer();
  return toProfileDto(await getUserProfile(viewer.id));
}

export async function saveProfileAction(
  input: ProfileFormInput,
): Promise<ProfileDto> {
  const viewer = await requireViewer();
  const row = await upsertUserProfile(viewer.id, input);
  revalidateIdentity();
  const dto = toProfileDto(row);
  if (!dto) {
    throw new Error("Could not save profile.");
  }
  return dto;
}

/** Compact shape for debugging; UI uses full ProfileDto. */
export async function getCompactProfileAction(): Promise<Record<
  string,
  string | number | boolean
> | null> {
  const dto = await getProfileAction();
  return dto ? compactProfileDto(dto) : null;
}
