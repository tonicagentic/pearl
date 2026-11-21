import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  mergeCapabilityInput,
  normalizeCapabilityInput,
  type CapabilityFormInput,
} from "@/lib/capabilities/validation";
import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import {
  capability,
  type Capability,
  type CapabilityKind,
  type CapabilityStatus,
} from "@/lib/db/schema";

export type CapabilityCreateInput = {
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly summary: string;
  readonly audience?: string | null;
  readonly proof?: string | null;
  readonly status?: CapabilityStatus | null;
  readonly projectId?: string | null;
  readonly notes?: string | null;
};

export type ListCapabilitiesFilter = {
  readonly kind?: CapabilityKind;
  /** When omitted, returns active and exploring (not archived). */
  readonly statuses?: readonly CapabilityStatus[];
};

async function assertProjectOwned(
  userId: string,
  projectId: string | null,
): Promise<void> {
  if (!projectId) return;
  const owned = await getProject(userId, projectId);
  if (!owned) {
    throw new Error("Unknown project for this capability.");
  }
}

export async function listCapabilities(
  userId: string,
  filter: ListCapabilitiesFilter = {},
): Promise<readonly Capability[]> {
  const statuses = filter.statuses ?? (["active", "exploring"] as const);
  const conditions = [
    eq(capability.userId, userId),
    inArray(capability.status, [...statuses]),
  ];
  if (filter.kind) {
    conditions.push(eq(capability.kind, filter.kind));
  }
  return db
    .select()
    .from(capability)
    .where(and(...conditions))
    .orderBy(asc(capability.name));
}

export async function getCapability(
  userId: string,
  id: string,
): Promise<Capability | null> {
  const [row] = await db
    .select()
    .from(capability)
    .where(and(eq(capability.userId, userId), eq(capability.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getCapabilityByName(
  userId: string,
  name: string,
): Promise<Capability | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select()
    .from(capability)
    .where(
      and(
        eq(capability.userId, userId),
        sql`lower(${capability.name}) = lower(${trimmed})`,
      ),
    )
    .limit(1);
  return row ?? null;
}

function rowFields(row: Capability) {
  return {
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    audience: row.audience,
    proof: row.proof,
    status: row.status,
    projectId: row.projectId,
    notes: row.notes,
  };
}

/**
 * Create a capability, or update the existing row when the name already
 * matches case-insensitively for this user.
 */
export async function saveCapability(
  userId: string,
  input: CapabilityCreateInput & { readonly id?: string },
): Promise<{ readonly row: Capability; readonly created: boolean }> {
  if (input.id) {
    const existing = await getCapability(userId, input.id);
    if (!existing) {
      throw new Error("Unknown capability.");
    }
    const normalized = mergeCapabilityInput(rowFields(existing), input);
    await assertProjectOwned(userId, normalized.projectId);
    const byName = await getCapabilityByName(userId, normalized.name);
    if (byName && byName.id !== existing.id) {
      throw new Error(
        `Another capability already uses the name "${normalized.name}".`,
      );
    }
    const now = new Date();
    const [row] = await db
      .update(capability)
      .set({ ...normalized, updatedAt: now })
      .where(and(eq(capability.userId, userId), eq(capability.id, existing.id)))
      .returning();
    if (!row) throw new Error("Could not update capability.");
    return { row, created: false };
  }

  const byName = await getCapabilityByName(userId, input.name);
  if (byName) {
    const normalized = mergeCapabilityInput(rowFields(byName), input);
    await assertProjectOwned(userId, normalized.projectId);
    const now = new Date();
    const [row] = await db
      .update(capability)
      .set({ ...normalized, updatedAt: now })
      .where(and(eq(capability.userId, userId), eq(capability.id, byName.id)))
      .returning();
    if (!row) throw new Error("Could not update capability.");
    return { row, created: false };
  }

  const normalized = normalizeCapabilityInput(input);
  await assertProjectOwned(userId, normalized.projectId);
  const now = new Date();
  const [row] = await db
    .insert(capability)
    .values({
      userId,
      ...normalized,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Could not save capability.");
  return { row, created: true };
}

export async function updateCapability(
  userId: string,
  id: string,
  patch: CapabilityFormInput,
): Promise<Capability> {
  const existing = await getCapability(userId, id);
  if (!existing) {
    throw new Error("Unknown capability.");
  }
  const normalized = mergeCapabilityInput(rowFields(existing), patch);
  await assertProjectOwned(userId, normalized.projectId);
  if (normalized.name.toLowerCase() !== existing.name.toLowerCase()) {
    const byName = await getCapabilityByName(userId, normalized.name);
    if (byName && byName.id !== id) {
      throw new Error(
        `Another capability already uses the name "${normalized.name}".`,
      );
    }
  }
  const now = new Date();
  const [row] = await db
    .update(capability)
    .set({ ...normalized, updatedAt: now })
    .where(and(eq(capability.userId, userId), eq(capability.id, id)))
    .returning();
  if (!row) throw new Error("Could not update capability.");
  return row;
}

export async function archiveCapability(
  userId: string,
  id: string,
): Promise<Capability> {
  const existing = await getCapability(userId, id);
  if (!existing) {
    throw new Error("Unknown capability.");
  }
  if (existing.status === "archived") {
    return existing;
  }
  const now = new Date();
  const [row] = await db
    .update(capability)
    .set({ status: "archived", updatedAt: now })
    .where(and(eq(capability.userId, userId), eq(capability.id, id)))
    .returning();
  if (!row) throw new Error("Could not archive capability.");
  return row;
}

/** Active name/kind/summary rows for the per-turn instruction index. */
export async function listActiveCapabilityIndex(
  userId: string,
  limit: number,
): Promise<{
  readonly active: readonly Pick<
    Capability,
    "id" | "name" | "kind" | "summary"
  >[];
  readonly exploringCount: number;
}> {
  const active = await db
    .select({
      id: capability.id,
      name: capability.name,
      kind: capability.kind,
      summary: capability.summary,
    })
    .from(capability)
    .where(
      and(eq(capability.userId, userId), eq(capability.status, "active")),
    )
    .orderBy(asc(capability.name))
    .limit(limit);

  const [exploring] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(capability)
    .where(
      and(
        eq(capability.userId, userId),
        eq(capability.status, "exploring"),
      ),
    );

  return {
    active,
    exploringCount: exploring?.count ?? 0,
  };
}

export async function countNonArchivedCapabilities(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(capability)
    .where(
      and(eq(capability.userId, userId), ne(capability.status, "archived")),
    );
  return row?.count ?? 0;
}
