import {
  artifactsPrefix,
  normalizeArtifactSlug,
} from "@/agent/lib/artifacts";
import { contentTypeForWorkspacePath } from "@/agent/lib/design-files";
import { putPrivateBlob } from "@/lib/blob/private";
import {
  getChatLinkByEveSessionId,
  upsertAgentFile,
} from "@/lib/db/queries";

// On a brand-new chat the browser client links the eve session id to the chat
// row via onSessionChange. The poll is only a fallback for slow links.
const CHAT_LINK_POLL_SCHEDULE_MS = [...Array<number>(10).fill(250)];

async function waitForChatLink(
  sessionId: string,
): Promise<{ id: string; userId: string } | null> {
  for (const delayMs of CHAT_LINK_POLL_SCHEDULE_MS) {
    const link = await getChatLinkByEveSessionId(sessionId);

    if (link) {
      return link;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

/**
 * Mirror a sandbox write into Postgres (and Blob when available) so the chat
 * UI can render the file and future sessions can re-seed it. Best-effort:
 * a database outage must not fail the model's file write.
 */
export async function persistAgentFile(
  ctx: { session: { id: string } },
  path: string,
  content: string,
): Promise<{ persisted: boolean; note?: string }> {
  try {
    const chatLink = await waitForChatLink(ctx.session.id);

    if (!chatLink) {
      return {
        persisted: false,
        note: "File written to the sandbox, but no chat is linked to this session yet, so it was not saved for later use.",
      };
    }

    let blobPathname: string | undefined;

    try {
      const prefix = artifactsPrefix({
        principalId: chatLink.userId,
        principalType: "user",
      });

      if (prefix) {
        const slug = normalizeArtifactSlug(path);

        if (slug) {
          const blob = await putPrivateBlob(`${prefix}${slug}`, content, {
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: contentTypeForWorkspacePath(path),
            signGet: false,
          });

          blobPathname = blob.pathname || `${prefix}${slug}`;
        }
      }
    } catch {
      blobPathname = undefined;
    }

    await upsertAgentFile({
      chatId: chatLink.id,
      path,
      content,
      blobPathname,
    });

    return { persisted: true };
  } catch (error) {
    return {
      persisted: false,
      note: `File written to the sandbox, but saving a durable copy failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Mirror a binary sandbox write (images, PDFs) into Blob + Postgres so the
 * Computer file tree can list it and later sessions can re-seed bytes.
 * Best-effort: storage failures must not fail the tool's sandbox write.
 */
export async function persistAgentFileBinary(
  ctx: { session: { id: string } },
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{
  persisted: boolean;
  note?: string;
  blobPathname?: string;
  url?: string;
  downloadUrl?: string;
}> {
  try {
    const chatLink = await waitForChatLink(ctx.session.id);

    if (!chatLink) {
      return {
        persisted: false,
        note: "File written to the sandbox, but no chat is linked to this session yet, so it was not saved for later use.",
      };
    }

    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    let blobPathname: string | undefined;
    let url: string | undefined;
    let downloadUrl: string | undefined;

    try {
      const prefix = artifactsPrefix({
        principalId: chatLink.userId,
        principalType: "user",
      });

      if (prefix) {
        const slug = normalizeArtifactSlug(path);

        if (slug) {
          const blob = await putPrivateBlob(`${prefix}${slug}`, bytes, {
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType,
            signGet: true,
          });

          blobPathname = blob.pathname || `${prefix}${slug}`;
          url = blob.url;
          downloadUrl = blob.downloadUrl;
        }
      }
    } catch {
      blobPathname = undefined;
    }

    await upsertAgentFile({
      chatId: chatLink.id,
      path,
      // Blob-primary: row holds the reference; revision keeps a short marker.
      content: blobPathname ? `[binary:${blobPathname}]` : "",
      blobPathname,
      byteLength: bytes.byteLength,
    });

    return { persisted: true, blobPathname, url, downloadUrl };
  } catch (error) {
    return {
      persisted: false,
      note: `File written to the sandbox, but saving a durable copy failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
