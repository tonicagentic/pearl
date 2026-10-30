import { randomUUID } from "node:crypto";

import {
  beginExecution,
  completeExecution,
  executionKey,
  failExecution,
} from "@/lib/agent/execution-ledger";
import { ensureUserForPrincipal } from "@/lib/db/issues";

import {
  getMiniApp,
  getMiniAppBySlug,
  insertMiniApp,
  listMiniApps,
  toPublicMiniApp,
  type MiniAppPublic,
} from "./queries.ts";
import { normalizePearlSlug } from "./slug.ts";

export type CreateAppInput = {
  readonly userId: string;
  readonly userName?: string;
  readonly userEmail?: string;
  readonly slug: string;
  readonly title: string;
};

/**
 * Register a mini_app draft with a durable fx session id. Does not touch
 * GitHub — coding happens in a Vercel Sandbox via code_with_fx; publish_app
 * creates the pearl-* repo when the user is ready to ship.
 *
 * Kept free of libfx / @vercel/sandbox so eve can evaluate create_app / list_apps.
 */
export async function createApp(
  input: CreateAppInput,
): Promise<
  | { readonly status: "created"; readonly app: MiniAppPublic }
  | { readonly status: "already-created"; readonly app: MiniAppPublic }
  | { readonly status: "error"; readonly error: string }
> {
  const slug = normalizePearlSlug(input.slug);
  if (!slug) {
    return {
      status: "error",
      error:
        "Slug must be lowercase letters, digits, and hyphens (e.g. my-notes or pearl-my-notes).",
    };
  }

  const title = input.title.trim() || slug;
  const key = executionKey("create_app", `${input.userId}\u0000${slug}`);
  const prior = await beginExecution("create_app", key);

  if (prior.prior?.status === "succeeded" && prior.prior.detail) {
    try {
      const parsed = JSON.parse(prior.prior.detail) as { appId?: string };
      if (parsed.appId) {
        const existing = await getMiniApp(input.userId, parsed.appId);
        if (existing) {
          return { status: "already-created", app: toPublicMiniApp(existing) };
        }
      }
    } catch {
      // Fall through to lookup by slug.
    }
    const bySlug = await getMiniAppBySlug(input.userId, slug);
    if (bySlug) {
      return { status: "already-created", app: toPublicMiniApp(bySlug) };
    }
  }

  if (prior.prior?.status === "pending") {
    return {
      status: "error",
      error:
        "A previous create_app for this slug is still pending. Retry in a moment.",
    };
  }

  const existing = await getMiniAppBySlug(input.userId, slug);
  if (existing) {
    await completeExecution(key, JSON.stringify({ appId: existing.id }));
    return { status: "already-created", app: toPublicMiniApp(existing) };
  }

  try {
    await ensureUserForPrincipal({
      principalId: input.userId,
      attributes: {
        name: input.userName ?? "Pearl user",
        email: input.userEmail ?? `${input.userId}@users.pearl.local`,
      },
    });

    // fx session ids must come from pearlBuilderFx.newSessionId() (wrun_…);
    // code_with_fx allocates on first use. Provisional sandbox name until then.
    const sandbox = `pearl-app-${randomUUID()}`;

    const row = await insertMiniApp({
      userId: input.userId,
      slug,
      title,
      sandboxName: sandbox,
      fxSessionId: null,
    });

    await completeExecution(key, JSON.stringify({ appId: row.id }));
    return { status: "created", app: toPublicMiniApp(row) };
  } catch (error) {
    await failExecution(
      key,
      error instanceof Error ? error.message : String(error),
    );
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listAppsForUser(
  userId: string,
): Promise<readonly MiniAppPublic[]> {
  const rows = await listMiniApps(userId);
  return rows.map(toPublicMiniApp);
}
