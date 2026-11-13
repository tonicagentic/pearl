import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  workbenchPin,
  type WorkbenchPinRow,
} from "@/lib/db/schema";
import { pinFullName, validatePinInput } from "@/lib/workbench/pins";
import type { WorkbenchPin } from "@/lib/workbench/types";

function toDto(row: WorkbenchPinRow): WorkbenchPin {
  return {
    id: row.id,
    userId: row.userId,
    owner: row.owner,
    name: row.name,
    fullName: pinFullName(row),
    vercelProjectId: row.vercelProjectId,
    vercelTeamId: row.vercelTeamId,
    expoProjectId: row.expoProjectId,
    expoUpdateChannel: row.expoUpdateChannel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWorkbenchPins(
  userId: string,
): Promise<readonly WorkbenchPin[]> {
  const rows = await db
    .select()
    .from(workbenchPin)
    .where(eq(workbenchPin.userId, userId))
    .orderBy(asc(workbenchPin.owner), asc(workbenchPin.name));
  return rows.map(toDto);
}

export async function getWorkbenchPin(
  userId: string,
  pinId: string,
): Promise<WorkbenchPin | null> {
  const [row] = await db
    .select()
    .from(workbenchPin)
    .where(and(eq(workbenchPin.userId, userId), eq(workbenchPin.id, pinId)))
    .limit(1);
  return row ? toDto(row) : null;
}

export async function createWorkbenchPin(
  userId: string,
  input: {
    readonly owner?: string;
    readonly name?: string;
    readonly fullName?: string;
    readonly vercelProjectId?: string | null;
    readonly vercelTeamId?: string | null;
    readonly expoProjectId?: string | null;
    readonly expoUpdateChannel?: string | null;
  },
): Promise<WorkbenchPin> {
  const validated = validatePinInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const [row] = await db
    .insert(workbenchPin)
    .values({
      userId,
      owner: validated.pin.owner,
      name: validated.pin.name,
      vercelProjectId: validated.pin.vercelProjectId ?? null,
      vercelTeamId: validated.pin.vercelTeamId ?? null,
      expoProjectId: validated.pin.expoProjectId ?? null,
      expoUpdateChannel: validated.pin.expoUpdateChannel ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create workbench pin.");
  return toDto(row);
}

export async function updateWorkbenchPin(
  userId: string,
  pinId: string,
  input: {
    readonly vercelProjectId?: string | null;
    readonly vercelTeamId?: string | null;
    readonly expoProjectId?: string | null;
    readonly expoUpdateChannel?: string | null;
  },
): Promise<WorkbenchPin | null> {
  const existing = await getWorkbenchPin(userId, pinId);
  if (!existing) return null;

  const [row] = await db
    .update(workbenchPin)
    .set({
      vercelProjectId:
        input.vercelProjectId !== undefined
          ? input.vercelProjectId
          : existing.vercelProjectId,
      vercelTeamId:
        input.vercelTeamId !== undefined
          ? input.vercelTeamId
          : existing.vercelTeamId,
      expoProjectId:
        input.expoProjectId !== undefined
          ? input.expoProjectId
          : existing.expoProjectId,
      expoUpdateChannel:
        input.expoUpdateChannel !== undefined
          ? input.expoUpdateChannel
          : existing.expoUpdateChannel,
      updatedAt: new Date(),
    })
    .where(and(eq(workbenchPin.userId, userId), eq(workbenchPin.id, pinId)))
    .returning();
  return row ? toDto(row) : null;
}

export async function deleteWorkbenchPin(
  userId: string,
  pinId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(workbenchPin)
    .where(and(eq(workbenchPin.userId, userId), eq(workbenchPin.id, pinId)))
    .returning({ id: workbenchPin.id });
  return deleted.length > 0;
}
