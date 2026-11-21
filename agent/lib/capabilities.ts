import {
  archiveCapability,
  getCapability,
  listActiveCapabilityIndex,
  listCapabilities,
  saveCapability,
  type CapabilityCreateInput,
  type ListCapabilitiesFilter,
} from "@/lib/db/capabilities";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { Capability } from "@/lib/db/schema";
import { MAX_CAPABILITY_INDEX_ENTRIES } from "@/lib/capabilities/validation";

/**
 * Structural subset of eve's session principal for capability tools.
 */
export type CapabilityPrincipal =
  | {
      readonly principalId: string;
      readonly principalType: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    }
  | null
  | undefined;

function requireUserPrincipal(principal: CapabilityPrincipal): {
  readonly principalId: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
} {
  if (principal?.principalType !== "user" || !principal.principalId) {
    throw new Error("Sign in to manage capabilities.");
  }
  return {
    principalId: principal.principalId,
    attributes: principal.attributes ?? {},
  };
}

async function ensureUser(principal: CapabilityPrincipal): Promise<string> {
  const user = requireUserPrincipal(principal);
  await ensureUserForPrincipal({
    principalId: user.principalId,
    attributes: user.attributes,
  });
  return user.principalId;
}

export function serializeCapability(row: Capability) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    audience: row.audience,
    proof: row.proof,
    status: row.status,
    projectId: row.projectId,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCapabilitiesForPrincipal(
  principal: CapabilityPrincipal,
  filter: ListCapabilitiesFilter = {},
) {
  const userId = await ensureUser(principal);
  const rows = await listCapabilities(userId, filter);
  return rows.map(serializeCapability);
}

export async function saveCapabilityForPrincipal(
  principal: CapabilityPrincipal,
  input: CapabilityCreateInput & { readonly id?: string },
) {
  const userId = await ensureUser(principal);
  const result = await saveCapability(userId, input);
  return {
    created: result.created,
    capability: serializeCapability(result.row),
  };
}

export async function archiveCapabilityForPrincipal(
  principal: CapabilityPrincipal,
  id: string,
) {
  const userId = await ensureUser(principal);
  const row = await archiveCapability(userId, id);
  return serializeCapability(row);
}

export async function getCapabilityIndexForPrincipal(
  principal: CapabilityPrincipal,
) {
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }
  try {
    await ensureUserForPrincipal({
      principalId: principal.principalId,
      attributes: principal.attributes ?? {},
    });
    return listActiveCapabilityIndex(
      principal.principalId,
      MAX_CAPABILITY_INDEX_ENTRIES,
    );
  } catch {
    return null;
  }
}

export async function getCapabilityForPrincipal(
  principal: CapabilityPrincipal,
  id: string,
) {
  const userId = await ensureUser(principal);
  return getCapability(userId, id);
}
