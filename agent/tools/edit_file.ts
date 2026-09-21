import { z } from "zod";
import { defineTool } from "eve/tools";
import { writeFile } from "eve/tools/write_file";

import { withFileLock } from "@/lib/agent/file-mutex";
import { persistAgentFile } from "@/agent/tools/write_file";

type WriteOutcome = { existed: boolean; path: string };

type SandboxLike = {
  readTextFile(input: { path: string }): Promise<string | null>;
};

function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<unknown> {
  return (
    typeof (value as { [Symbol.asyncIterator]?: unknown })[
      Symbol.asyncIterator
    ] === "function"
  );
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

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

// Targeted file edit: replace one exact span of text and leave the rest of
// the file untouched. For a long draft this is the difference between a
// paragraph-sized update and re-emitting the whole document on every
// revision — full-file rewrites burn tokens and risk drifting text the user
// already accepted.
//
// The old text must match exactly once; zero or multiple matches return an
// error so the model re-reads and retries with more surrounding context
// instead of silently corrupting the wrong span. The write still goes through
// eve's write_file (sandbox validation) and the Postgres mirror, so the
// canvas stays in sync.
export default defineTool({
  label: {
    start: (input: { filePath: string }) => `Edit ${input.filePath}`,
  },
  description: [
    "Make a targeted edit to an existing file: replace one exact span of text and leave everything else untouched.",
    "",
    "Usage:",
    "- The filePath parameter should be an absolute path or begin with $HOME/.",
    "- oldText must appear exactly once in the file. Copy it verbatim from a recent read, including indentation and surrounding whitespace.",
    "- Prefer this over rewriting the whole file: pass only the paragraph or lines that change, not the full document.",
    "- If oldText appears zero or multiple times, nothing is written; broaden or disambiguate the span and retry.",
  ].join("\n"),
  inputSchema: z.strictObject({
    filePath: z
      .string()
      .describe(
        "The absolute path to the file to edit. A leading $HOME is supported.",
      ),
    oldText: z
      .string()
      .describe(
        "The exact existing text to replace, copied verbatim from the file (it must match exactly once).",
      ),
    newText: z.string().describe("The replacement text."),
  }),
  async execute(input, ctx) {
    // Same-file mutations are serialized: parallel edit_file calls each read
    // the same base content and last-write-wins, silently dropping one edit.
    return withFileLock(input.filePath, async () => {
      const sandbox = (await (ctx as { getSandbox: () => Promise<unknown> })
        .getSandbox()) as SandboxLike;

      let current: string | null;
      try {
        current = await sandbox.readTextFile({ path: input.filePath });
      } catch (error) {
        return {
          updated: false,
          note: `Could not read ${input.filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }

      if (current === null) {
        return {
          updated: false,
          note: `File not found: ${input.filePath}. Read the file first or create it with write_file.`,
        };
      }

      const occurrences = countOccurrences(current, input.oldText);
      if (occurrences === 0) {
        return {
          updated: false,
          note: "oldText was not found in the file. Read the file and copy the exact text to replace, including whitespace and line breaks.",
        };
      }
      if (occurrences > 1) {
        return {
          updated: false,
          note: `oldText appears ${occurrences} times — include more surrounding text so the edit target is unique.`,
        };
      }

      const updated = current.replace(input.oldText, input.newText);

      const outcome = await resolveOutcome(
        await writeFile.execute(
          { filePath: input.filePath, content: updated },
          ctx as never,
        ),
      );

      const persistence = await persistAgentFile(
        ctx as { session: { id: string } },
        outcome.path,
        updated,
      );

      return {
        path: outcome.path,
        updated: true,
        ...persistence,
      };
    });
  },
});
