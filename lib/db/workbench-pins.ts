import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  project,
  projectPin,
  workbenchPin,
  type WorkbenchPinRow,
} from "@/lib/db/schema";
import { pinFullName, validatePinInput } from "@/lib/workbench/pins";
import type { WorkbenchPin } from "@/lib/workbench/types";

export function toWorkbenchPinDto(row: WorkbenchPinRow): WorkbenchPin {
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

const toDto = toWorkbenchPinDto;

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

/** Pins linked to a project, ordered by sort_order then owner/name. */
export async function listProjectPins(
  userId: string,
  projectId: string,
): Promise<readonly WorkbenchPin[]> {
  const owned = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  if (!owned[0]) return [];

  const rows = await db
    .select({
      pin: workbenchPin,
      sortOrder: projectPin.sortOrder,
    })
    .from(projectPin)
    .innerJoin(workbenchPin, eq(projectPin.pinId, workbenchPin.id))
    .where(
      and(
        eq(projectPin.projectId, projectId),
        eq(workbenchPin.userId, userId),
      ),
    )
    .orderBy(
      asc(projectPin.sortOrder),
      asc(workbenchPin.owner),
      asc(workbenchPin.name),
    );

  return rows.map((row) => toDto(row.pin));
}

export async function linkPinToProject(
  userId: string,
  projectId: string,
  pinId: string,
): Promise<WorkbenchPin | null> {
  const [ownedProject] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  if (!ownedProject) return null;

  const pin = await getWorkbenchPin(userId, pinId);
  if (!pin) return null;

  const [existing] = await db
    .select({ id: projectPin.id })
    .from(projectPin)
    .where(
      and(eq(projectPin.projectId, projectId), eq(projectPin.pinId, pinId)),
    )
    .limit(1);
  if (existing) return pin;

  const [agg] = await db
    .select({ maxOrder: max(projectPin.sortOrder) })
    .from(projectPin)
    .where(eq(projectPin.projectId, projectId));
  const nextOrder = (agg?.maxOrder ?? -1) + 1;

  await db.insert(projectPin).values({
    projectId,
    pinId,
    sortOrder: nextOrder,
  });
  return pin;
}

export async function unlinkPinFromProject(
  userId: string,
  projectId: string,
  pinId: string,
): Promise<boolean> {
  const [ownedProject] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  if (!ownedProject) return false;

  const pin = await getWorkbenchPin(userId, pinId);
  if (!pin) return false;

  const deleted = await db
    .delete(projectPin)
    .where(
      and(eq(projectPin.projectId, projectId), eq(projectPin.pinId, pinId)),
    )
    .returning({ id: projectPin.id });
  return deleted.length > 0;
}
