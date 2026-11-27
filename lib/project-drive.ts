import { Drive } from "@vercel/sandbox";

import { getProject, setProjectDriveName } from "@/lib/db/projects";
import { db } from "@/lib/db/client";
import { chat, project } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

/** Absolute path where project agents mount the shared Vercel Drive. */
export const PROJECT_DRIVE_MOUNT = "/workspace/drive";

/**
 * Derive a URL-safe Drive name from a project id (max 64 chars).
 * Vercel Drive names: alphanumeric, hyphens, underscores.
 */
export function driveNameForProject(projectId: string): string {
  const cleaned = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 56);
  return `pearl-proj-${cleaned || "workspace"}`.slice(0, 64);
}

/**
 * Resolve the project id for an eve session via its chat row.
 */
export async function getProjectIdForEveSession(
  sessionId: string,
): Promise<string | null> {
  const trimmed = sessionId.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ projectId: chat.projectId })
    .from(chat)
    .where(sql`${chat.eveSession} ->> 'sessionId' = ${trimmed}`)
    .limit(1);
  return row?.projectId ?? null;
}

/**
 * Ensure the project has a Vercel Drive; create it on first use and store
 * the name. Returns null when the project is missing or Drive APIs fail
 * (local just-bash / missing credentials).
 */
export async function ensureProjectDrive(input: {
  readonly userId: string;
  readonly projectId: string;
}): Promise<string | null> {
  const owned = await getProject(input.userId, input.projectId);
  if (!owned) return null;
  if (owned.driveName) return owned.driveName;

  const name = driveNameForProject(input.projectId);
  try {
    await Drive.getOrCreate({ name });
  } catch {
    // Local / missing Vercel credentials — no mount.
    return null;
  }

  return setProjectDriveName(input.userId, input.projectId, name);
}

/**
 * Look up the drive name for a chat's project without provisioning.
 */
export async function getDriveNameForChat(
  userId: string,
  chatId: string,
): Promise<{ readonly projectId: string; readonly driveName: string | null } | null> {
  const [row] = await db
    .select({
      projectId: chat.projectId,
      driveName: project.driveName,
    })
    .from(chat)
    .leftJoin(project, eq(project.id, chat.projectId))
    .where(and(eq(chat.userId, userId), eq(chat.id, chatId)))
    .limit(1);
  if (!row?.projectId) return null;
  return { projectId: row.projectId, driveName: row.driveName };
}
