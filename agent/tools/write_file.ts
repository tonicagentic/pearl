import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";
import { houseLint } from "../lib/house-lint.js";
import { artifactsPrefix, normalizeArtifactSlug } from "../lib/artifacts.js";
import { put } from "@vercel/blob";
import { withFileLock } from "@/lib/agent/file-mutex";
import {
  getChatLinkByEveSessionId,
  upsertAgentFile,
} from "@/lib/db/queries";

type WriteOutcome = { existed: boolean; path: string };

// Shared by write_file and edit_file: mirror a sandbox write into Postgres so
// the chat UI can render the file and future sessions can re-seed it.
// Persistence is best-effort: a database outage must not fail the model's
// file write, so errors are reported in the result instead of thrown.
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

    // Blob-primary: the current content lives once, principal-scoped, so the
    // document is durable across chats and visible on the artifacts page
    // without any agent action. Postgres holds the reference, metadata, and
    // the revision history. If the Blob store is unreachable, fall back to
    // storing content in Postgres (legacy mode) so the chat-scoped path
    // still works.
    let blobPathname: string | undefined;

    try {
      const prefix = artifactsPrefix({
        principalId: chatLink.userId,
        principalType: "user",
      });

      if (prefix) {
        const slug = normalizeArtifactSlug(path);

        if (slug) {
          const blob = await put(`${prefix}${slug}`, content, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "text/markdown",
          });

          blobPathname = blob.pathname ?? `${prefix}${slug}`;
        }
      }
    } catch {
      // Blob unavailable: the Postgres fallback below keeps the write durable
      // for this chat.
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

// On a brand-new chat the browser client links the eve session id to the chat
// row via onSessionChange, which fires when the runtime creates the session at
// the start of the first turn. The poll is only a fallback for slow links.
// Keep it short: this runs inside the durable turn step, so every poll second
// is dead air in the turn (docs: checkpoint-optimization-plan.md). A write
// that misses the link loses only its chat-scoped DB mirror — durable copies
// go through save_artifact, and the note tells the model.
const CHAT_LINK_POLL_SCHEDULE_MS = [...Array<number>(10).fill(250)];

async function waitForChatLink(sessionId: string): Promise<{ id: string; userId: string } | null> {
  for (const delayMs of CHAT_LINK_POLL_SCHEDULE_MS) {
    const link = await getChatLinkByEveSessionId(sessionId);

    if (link) {
      return link;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

function isAsyncIterable(
  value: WriteOutcome | AsyncIterable<WriteOutcome>,
): value is AsyncIterable<WriteOutcome> {
  return typeof (value as { [Symbol.asyncIterator]?: unknown })[
    Symbol.asyncIterator
  ] === "function";
}

// The framework's execute contract allows a streamed AsyncIterable output;
// the sandbox write resolves to a single final object, so consume any stream.
async function resolveOutcome(
  outcome: WriteOutcome | AsyncIterable<WriteOutcome>,
): Promise<WriteOutcome> {
  if (isAsyncIterable(outcome)) {
    let last: WriteOutcome | undefined;

    for await (const chunk of outcome) {
      last = chunk;
    }

    if (!last) {
      throw new Error("write_file produced no result.");
    }

    return last;
  }

  return outcome;
}

// Sandbox-persistent but session-bound: eve's built-in write_file writes into
// the durable session sandbox, which is gone once the session ends. This
// override keeps the built-in behavior and mirrors every write into Postgres
// so the chat UI can render the file and future sessions can re-seed it.
//
// Persistence is best-effort: a database outage must not fail the model's
// file write, so errors are reported in the result instead of thrown.
export default defineTool({
  ...writeFile,
  async execute(input, ctx) {
    // Same-file mutations are serialized with edit_file (shared per-path
    // lock): a write racing a targeted edit is the same lost-update shape.
    return withFileLock(input.filePath, async () => {
      // eve passes the enriched session context (ctx.getSandbox, ctx.session)
      // as the second execute argument at runtime; the framework type widens
      // it to the AI SDK execute options.
      const outcome = await resolveOutcome(
        await writeFile.execute(input, ctx as never),
      );

      const persistence = await persistAgentFile(
        ctx,
        outcome.path,
        input.content,
      );

      // House mechanical rules, checked on the final content: the model sees
      // violations right in the write result and can fix them with a targeted
      // edit instead of shipping prose that breaks the house rules.
      return { ...outcome, ...persistence, lint: houseLint(input.content) };
    });
  },
});
