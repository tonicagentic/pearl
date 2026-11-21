"use server";

import { revalidatePath } from "next/cache";

import {
  CapabilityInputError,
  type CapabilityFormInput,
} from "@/lib/capabilities/validation";
import { toCapabilityDto, type CapabilityDto } from "@/lib/capabilities/serialize";
import {
  archiveCapability,
  listCapabilities,
  saveCapability,
  updateCapability,
  type CapabilityCreateInput,
} from "@/lib/db/capabilities";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { CapabilityStatus } from "@/lib/db/schema";
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

function revalidateCapabilities() {
  revalidatePath("/settings/capabilities");
}

function asActionError(error: unknown): never {
  if (error instanceof CapabilityInputError) {
    throw new Error(error.message);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error("Could not update capabilities.");
}

export type { CapabilityDto, CapabilityFormInput, CapabilityCreateInput };

export async function listCapabilitiesAction(
  includeArchived = false,
): Promise<readonly CapabilityDto[]> {
  const viewer = await requireViewer();
  const statuses: readonly CapabilityStatus[] = includeArchived
    ? ["active", "exploring", "archived"]
    : ["active", "exploring"];
  const rows = await listCapabilities(viewer.id, { statuses });
  return rows.map(toCapabilityDto);
}

export async function saveCapabilityAction(
  input: CapabilityCreateInput & { readonly id?: string },
): Promise<CapabilityDto> {
  const viewer = await requireViewer();
  try {
    const { row } = await saveCapability(viewer.id, input);
    revalidateCapabilities();
    return toCapabilityDto(row);
  } catch (error) {
    asActionError(error);
  }
}

export async function updateCapabilityAction(
  id: string,
  patch: CapabilityFormInput,
): Promise<CapabilityDto> {
  const viewer = await requireViewer();
  try {
    const row = await updateCapability(viewer.id, id, patch);
    revalidateCapabilities();
    return toCapabilityDto(row);
  } catch (error) {
    asActionError(error);
  }
}

export async function archiveCapabilityAction(
  id: string,
): Promise<CapabilityDto> {
  const viewer = await requireViewer();
  try {
    const row = await archiveCapability(viewer.id, id);
    revalidateCapabilities();
    return toCapabilityDto(row);
  } catch (error) {
    asActionError(error);
  }
}
