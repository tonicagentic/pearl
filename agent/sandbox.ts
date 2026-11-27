import { list } from "@vercel/blob";
import { DefaultSandbox, defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
import { isBinaryWorkspacePath } from "@/agent/lib/design-files";
import {
  readPrivateBlobBytes,
  readPrivateBlobText,
} from "@/lib/blob/private";
import {
  getChatIdByEveSessionId,
  listAgentFileSeeds,
} from "@/lib/db/queries";
import {
  ensureProjectDrive,
  getProjectIdForEveSession,
  PROJECT_DRIVE_MOUNT,
} from "@/lib/project-drive";
import { artifactsPrefix, artifactSandboxPath } from "./lib/artifacts";

// Writing sandbox for drafts and research notes. Coding work belongs in the
// coder subagent's own sandbox — never put application source here.
//
// Non-project chats: restore principal Blob artifacts + legacy DB seeds.
// Project chats on Vercel: mount the shared project Drive at /workspace/drive
// and skip principal-wide Blob restore (Library stays the files view).
export const environment = DefaultSandbox.environment();
const vercelEnvironment = VercelSandbox.environment();

export default defineSandbox(async ({ session }) => {
  const principalId = session.auth.current?.principalId ?? null;
  const projectId = await getProjectIdForEveSession(session.id).catch(
    () => null,
  );

  let driveName: string | null = null;
  if (principalId && projectId) {
    driveName = await ensureProjectDrive({
      userId: principalId,
      projectId,
    }).catch(() => null);
  }

  let sandbox;
  if (driveName) {
    try {
      sandbox = await vercelEnvironment.open({
        networkPolicy: "deny-all",
        mounts: {
          [PROJECT_DRIVE_MOUNT]: { name: driveName },
        },
      });
    } catch {
      // Local / just-bash cannot mount Drives — fall through.
      driveName = null;
    }
  }

  if (!sandbox) {
    try {
      sandbox = await environment.open({ networkPolicy: "deny-all" });
    } catch {
      sandbox = await environment.open();
    }
  }

  if (principalId) {
    const { noteSandboxOpened } = await import("@/lib/billing/sandbox-meter");
    noteSandboxOpened({
      sandboxId: `writing:${session.id}`,
      userId: principalId,
      vcpus: 2,
      label: "writing",
    });
  }

  // Project Drive is the shared workspace — do not also dump the principal
  // Blob library into this sandbox.
  if (driveName) {
    return sandbox;
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
