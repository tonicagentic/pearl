import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";
import { houseLint } from "../lib/house-lint.js";
import { isDesignFilePath } from "../lib/design-files.js";
import { withFileLock } from "@/lib/agent/file-mutex";
import { persistAgentFile } from "@/lib/agent/persist-agent-file";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

export { persistAgentFile } from "@/lib/agent/persist-agent-file";

type WriteOutcome = { existed: boolean; path: string };

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
    if (isPlanMode()) {
      throw new Error(planModeBlocked("write_file").error);
    }
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

      // House mechanical rules apply to prose drafts only. Design source
      // (.html, .svg, .mmd, .scene.json) skips lint so CSS and markup are not
      // scored as writing.
      const lint = isDesignFilePath(outcome.path)
        ? []
        : houseLint(input.content);
      return { ...outcome, ...persistence, lint };
    });
  },
});
