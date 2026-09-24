import { list } from "@vercel/blob";
import { defineSandbox } from "eve/sandbox";
import {
  getChatIdByEveSessionId,
  listAgentFileSeeds,
} from "@/lib/db/queries";
import { artifactsPrefix, artifactSandboxPath } from "./lib/artifacts";

// Files the agent writes survive across turns inside one session sandbox,
// but a new session starts empty. Restore in two layers, both best-effort so
// a storage hiccup must not block sandbox startup:
//
// 1. Blob artifacts — the principal's durable documents, synced automatically
//    by every write_file/edit_file. Restored for every new session so earlier
//    work is reachable regardless of which chat it came from.
// 2. DB seeds — legacy rows whose content still lives in Postgres only (rows
//    written before blob-primary sync, or Blob-fallback writes). Skipped when
//    a newer Blob artifact holds the same file.
export default defineSandbox({
  async onSession({ ctx, use }) {
    const session = await use();
    const restored = new Map<string, Date>();

    try {
      const prefix = artifactsPrefix(ctx.session.auth.current);

      if (prefix) {
        const { blobs } = await list({ prefix });
        for (const blob of blobs) {
          restored.set(
            blob.pathname.slice(prefix.length).split("/").pop() ?? "",
            blob.uploadedAt,
          );
          const path = artifactSandboxPath(blob.pathname);

          if (!path) {
            continue;
          }

          // Bounded fetch: a hung storage read must not stall the first turn
          // of a fresh session (docs: checkpoint-optimization-plan.md). On any
          // failure, stop restoring — the agent can still use restore_artifact.
          const response = await fetch(blob.url, {
            signal: AbortSignal.timeout(10_000),
          });

          if (!response.ok) {
            break;
          }

          await session.writeTextFile({
            content: await response.text(),
            path,
          });
        }
      }
    } catch {
      // The sandbox still starts; the agent can restore artifacts on demand
      // with restore_artifact.
    }

    try {
      const chatId = await getChatIdByEveSessionId(ctx.session.id);

      if (!chatId) {
        return;
      }

      const seeds = await listAgentFileSeeds(chatId);

      for (const seed of seeds) {
        // Newer-wins: a Blob artifact restored above that is at least as
        // recent as this legacy row supersedes it — never let an older
        // chat-scoped copy clobber newer durable state.
        const blobAt = restored.get(seed.path.split("/").pop() ?? "");

        if (blobAt && blobAt.getTime() >= seed.updatedAt.getTime()) {
          continue;
        }

        await session.writeTextFile({
          path: seed.path,
          content: seed.content,
        });
      }
    } catch {
      // Sandbox still starts empty; the turn proceeds without re-seeded files.
    }
  },
});
