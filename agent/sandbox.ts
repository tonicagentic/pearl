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
// 1. Blob artifacts — the principal's durable work products (drafts, notes)
//    synced by save_artifact. Restored for every new session so earlier
//    work is reachable regardless of which chat it came from.
// 2. DB seeds — the chat-scoped mirror maintained by write_file/edit_file.
export default defineSandbox({
  async onSession({ ctx, use }) {
    const session = await use();

    try {
      const prefix = artifactsPrefix(ctx.session.auth.current);

      if (prefix) {
        const { blobs } = await list({ prefix });

        for (const blob of blobs) {
          const path = artifactSandboxPath(blob.pathname);

          if (!path) {
            continue;
          }

          const response = await fetch(blob.url);

          if (!response.ok) {
            continue;
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
