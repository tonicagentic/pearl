import { list } from "@vercel/blob";
import { DefaultSandbox, defineSandbox } from "eve/sandbox";
import { isBinaryWorkspacePath } from "@/agent/lib/design-files";
import {
  readPrivateBlobBytes,
  readPrivateBlobText,
} from "@/lib/blob/private";
import {
  getChatIdByEveSessionId,
  listAgentFileSeeds,
} from "@/lib/db/queries";
import { artifactsPrefix, artifactSandboxPath } from "./lib/artifacts";

// Writing sandbox for drafts and research notes. Coding work belongs in the
// coder subagent's own sandbox — never put application source here.
//
// Files the agent writes survive across turns inside one session sandbox,
// but a new session starts empty. Restore in two layers after open(), both
// best-effort so a storage hiccup must not block sandbox startup:
//
// 1. Blob artifacts — the principal's durable documents, synced automatically
//    by every write_file/edit_file. Restored for every new session so earlier
//    work is reachable regardless of which chat it came from.
// 2. DB seeds — legacy rows whose content still lives in Postgres only (rows
//    written before blob-primary sync, or Blob-fallback writes). Skipped when
//    a newer Blob artifact holds the same file.
export const environment = DefaultSandbox.environment();

export default defineSandbox(async ({ session }) => {
  // Writing sandbox has no package installs or deploys — deny egress when the
  // provider can enforce it (Vercel / Docker). just-bash only supports
  // allow-all, so fall back without a policy there.
  let sandbox;
  try {
    sandbox = await environment.open({ networkPolicy: "deny-all" });
  } catch {
    sandbox = await environment.open();
  }
  const principalId = session.auth.current?.principalId;
  if (principalId) {
    const { noteSandboxOpened } = await import("@/lib/billing/sandbox-meter");
    noteSandboxOpened({
      sandboxId: `writing:${session.id}`,
      userId: principalId,
      vcpus: 2,
      label: "writing",
    });
  }
  const restored = new Map<string, Date>();

  try {
    const prefix = artifactsPrefix(session.auth.current);

    if (prefix) {
      const { blobs } = await list({ prefix });
      for (const blob of blobs) {
        const relative = blob.pathname.slice(prefix.length);
        restored.set(relative, blob.uploadedAt);
        const path = artifactSandboxPath(blob.pathname);

        if (!path) {
          continue;
        }

        // Bounded private read: a hung storage read must not stall the first
        // turn of a fresh session. On any failure, stop restoring — the agent
        // can still use restore_artifact.
        if (isBinaryWorkspacePath(path)) {
          const bytes = await Promise.race([
            readPrivateBlobBytes(blob.pathname),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 10_000);
            }),
          ]);

          if (bytes === null) {
            break;
          }

          await sandbox.writeBinaryFile({
            content: bytes,
            path,
          });
          continue;
        }

        const content = await Promise.race([
          readPrivateBlobText(blob.pathname),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 10_000);
          }),
        ]);

        if (content === null) {
          break;
        }

        await sandbox.writeTextFile({
          content,
          path,
        });
      }
    }
  } catch {
    // The sandbox still starts; the agent can restore artifacts on demand
    // with restore_artifact.
  }

  try {
    const chatId = await getChatIdByEveSessionId(session.id);

    if (!chatId) {
      return sandbox;
    }

    const seeds = await listAgentFileSeeds(chatId);

    for (const seed of seeds) {
      // Newer-wins: a Blob artifact restored above that is at least as
      // recent as this legacy row supersedes it — never let an older
      // chat-scoped copy clobber newer durable state.
      const seedRelative = seed.path.replace(/^\/workspace\//, "");
      const blobAt = restored.get(seedRelative);

      if (blobAt && blobAt.getTime() >= seed.updatedAt.getTime()) {
        continue;
      }

      await sandbox.writeTextFile({
        path: seed.path,
        content: seed.content,
      });
    }
  } catch {
    // Sandbox still starts empty; the turn proceeds without re-seeded files.
  }

  return sandbox;
});
