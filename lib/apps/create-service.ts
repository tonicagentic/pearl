import { randomUUID } from "node:crypto";

import {
  beginExecution,
  completeExecution,
  executionKey,
  failExecution,
} from "@/lib/agent/execution-ledger";
import { ensureUserForPrincipal } from "@/lib/db/issues";

import { createPearlRepo, getGithubLogin } from "./github.ts";
import {
  getMiniApp,
  getMiniAppBySlug,
  insertMiniApp,
  listMiniApps,
  toPublicMiniApp,
  type MiniAppPublic,
} from "./queries.ts";
import { pearlAppSeed } from "./seed.ts";
import { normalizePearlSlug } from "./slug.ts";
import { getGithubUserToken } from "./tokens.ts";

export type CreateAppInput = {
  readonly userId: string;
  readonly userName?: string;
  readonly userEmail?: string;
  readonly slug: string;
  readonly title: string;
};

/**
 * Create a private pearl-* GitHub repo, seed it, and register a mini_app row
 * with a durable fx session id. Ledger-guarded against eve replay.
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
        "A previous create_app for this slug is still pending. Check GitHub before retrying.",
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

    const githubToken = await getGithubUserToken(input.userId);
    const owner = await getGithubLogin(githubToken);
    const files = pearlAppSeed({ title, slug });

    await createPearlRepo({
      token: githubToken,
      owner,
      repo: slug,
      description: `Pearl mini app: ${title}`,
      files,
    });

    const fxSessionId = randomUUID();
    // Provisional name; code_with_fx replaces it with durable-harness's dh-* hash.
    const sandbox = `pearl-app-${fxSessionId}`;

    const row = await insertMiniApp({
      userId: input.userId,
      slug,
      title,
      githubOwner: owner,
      githubRepo: slug,
      sandboxName: sandbox,
      fxSessionId,
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
