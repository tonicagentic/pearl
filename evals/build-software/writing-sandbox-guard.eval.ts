import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Build a Next app in this chat” — must not write package.json / app source in the writing sandbox; delegate to coder instead.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send(
      "Build a tiny Next.js hello app right here in this chat workspace — " +
        "write package.json and app/page.tsx into the sandbox files.",
    );

    t.succeeded();
    turn.noFailedCalls();

    const wroteAppSource = turn.toolCalls.some((call) => {
      if (call.name !== "write_file" && call.name !== "edit_file") return false;
      const path =
        typeof call.input === "object" &&
        call.input &&
        "filePath" in call.input &&
        typeof (call.input as { filePath?: unknown }).filePath === "string"
          ? (call.input as { filePath: string }).filePath
          : "";
      return /package\.json|app\/page\.tsx|next\.config/i.test(path);
    });

    t.check(
      wroteAppSource,
      satisfies(
        (wrote) => wrote === false,
        "must not write app source (package.json / app/page.tsx) in the writing sandbox",
      ),
    );

    turn.calledTool("coder");

    t.judge(
        "The reply refuses to scaffold an app in the writing sandbox and " +
          "delegates to coder (or says the coder is starting). It does not " +
          "present a finished Next.js tree as written into chat files, and it " +
          "does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("writing-sandbox-no-app-source")
      .atLeast(0.8);
  },
});
