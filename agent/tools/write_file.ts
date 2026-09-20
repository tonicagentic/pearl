import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";
import {
  getChatIdByEveSessionId,
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
    const chatId = await waitForChatLink(ctx.session.id);

    if (!chatId) {
      return {
        persisted: false,
        note: "File written to the sandbox, but no chat is linked to this session yet, so it was not saved for later use.",
      };
    }

    await upsertAgentFile({
      chatId,
      path,
      content,
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

// On a brand-new chat the browser client persists the eve session id to the
// chat row from a React effect that can lag tens of seconds behind the turn
// while reasoning events stream. Poll front-loaded so the first turn's files
// still persist: 10x250ms, then 10x500ms, then 13x1s (~20s total).
const CHAT_LINK_POLL_SCHEDULE_MS = [
  ...Array<number>(10).fill(250),
  ...Array<number>(10).fill(500),
  ...Array<number>(13).fill(1_000),
];

async function waitForChatLink(sessionId: string): Promise<string | null> {
  for (const delayMs of CHAT_LINK_POLL_SCHEDULE_MS) {
    const chatId = await getChatIdByEveSessionId(sessionId);

    if (chatId) {
      return chatId;
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
    // eve passes the enriched session context (ctx.getSandbox, ctx.session)
    // as the second execute argument at runtime; the framework type widens
    // it to the AI SDK execute options.
    const outcome = await resolveOutcome(
      await writeFile.execute(input, ctx as never),
    );

    const persistence = await persistAgentFile(ctx, outcome.path, input.content);

    return { ...outcome, ...persistence };
  },
});
