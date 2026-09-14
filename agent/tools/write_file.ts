import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";
import {
  getChatIdByEveSessionId,
  upsertAgentFile,
} from "@/lib/db/queries";

type WriteOutcome = { existed: boolean; path: string };

const CHAT_LINK_POLL_MS = 1_000;
const CHAT_LINK_MAX_POLLS = 6;

// On a brand-new chat the eve session id is saved to the chat row shortly
// after the first POST /eve/v1/session returns, and an early tool call can
// race it. Poll briefly so the first turn's files still persist.
async function waitForChatLink(sessionId: string): Promise<string | null> {
  for (let attempt = 0; attempt < CHAT_LINK_MAX_POLLS; attempt++) {
    const chatId = await getChatIdByEveSessionId(sessionId);

    if (chatId) {
      return chatId;
    }

    await new Promise((resolve) => setTimeout(resolve, CHAT_LINK_POLL_MS));
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
    // eve passes the enriched session context (ctx.getSandbox, ctx.session)
    // as the second execute argument at runtime; the framework type widens
    // it to the AI SDK execute options.
    const outcome = await resolveOutcome(
      await writeFile.execute(input, ctx as never),
    );

    try {
      const chatId = await waitForChatLink(ctx.session.id);

      if (!chatId) {
        return {
          ...outcome,
          persisted: false,
          note: "File written to the sandbox, but no chat is linked to this session yet, so it was not saved for later use.",
        };
      }

      await upsertAgentFile({
        chatId,
        path: outcome.path,
        content: input.content,
      });

      return { ...outcome, persisted: true };
    } catch (error) {
      return {
        ...outcome,
        persisted: false,
        note: `File written to the sandbox, but saving a durable copy failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  },
});
