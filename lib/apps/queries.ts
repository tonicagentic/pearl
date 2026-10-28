import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/client";
import { miniApp, type MiniApp, type MiniAppStatus } from "@/lib/db/schema";

export type MiniAppPublic = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly productionUrl: string | null;
  readonly status: MiniAppStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toPublicMiniApp(row: MiniApp): MiniAppPublic {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    productionUrl: row.productionUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMiniApps(userId: string): Promise<MiniApp[]> {
  return db
    .select()
    .from(miniApp)
    .where(eq(miniApp.userId, userId))
    .orderBy(desc(miniApp.updatedAt));
}

export async function getMiniApp(
  userId: string,
  id: string,
): Promise<MiniApp | null> {
  const [row] = await db
    .select()
    .from(miniApp)
    .where(and(eq(miniApp.userId, userId), eq(miniApp.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getMiniAppBySlug(
  userId: string,
  slug: string,
): Promise<MiniApp | null> {
  const [row] = await db
    .select()
    .from(miniApp)
    .where(and(eq(miniApp.userId, userId), eq(miniApp.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function insertMiniApp(input: {
  readonly userId: string;
  readonly slug: string;
  readonly title: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly sandboxName: string;
  readonly fxSessionId: string;
}): Promise<MiniApp> {
  const id = randomUUID();
  const [row] = await db
    .insert(miniApp)
    .values({
      id,
      userId: input.userId,
      slug: input.slug,
      title: input.title,
      githubOwner: input.githubOwner,
      githubRepo: input.githubRepo,
      sandboxName: input.sandboxName,
      fxSessionId: input.fxSessionId,
      status: "draft",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert mini_app row.");
  }
  return row;
}

export async function updateMiniApp(
  userId: string,
  id: string,
  patch: {
    readonly fxSessionId?: string | null;
    readonly sandboxName?: string;
    readonly vercelProjectId?: string | null;
    readonly productionUrl?: string | null;
    readonly status?: MiniAppStatus;
  },
): Promise<MiniApp | null> {
  const [row] = await db
    .update(miniApp)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(and(eq(miniApp.userId, userId), eq(miniApp.id, id)))
    .returning();
  return row ?? null;
}
