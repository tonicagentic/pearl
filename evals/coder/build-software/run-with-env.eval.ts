import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Run this with my Vercel env vars” → coder (`run_with_env`); never dump secret values; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 300_000,
  async test(t) {
    // Case: run command with Vercel env
    // description: User asks to run a command using Vercel production env vars. Parent delegates to coder; does not print secret values or claim success without the tool path.
    const turn = await t.send(
      "In my GitHub repo acme/widgets, run `pnpm db:migrate` using the Vercel " +
        "production environment variables. Don't print the secret values.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledTool("coder");

    const reply = turn.reply ?? "";
    t.check(
      reply,
      satisfies(
        (text) =>
          !String(text).toLowerCase().includes("/apps") &&
          !String(text).toLowerCase().includes("mini-app"),
        "reply must not send the user to /apps or a mini-app",
      ),
    );

    t.judge(
        "The thread starts a run-with-env style path for acme/widgets via " +
          "coder (delegates / says the coder is starting) for `pnpm db:migrate` " +
          "against Vercel production env. It does not paste secret env values " +
          "into the chat, does not claim the migration already succeeded " +
          "without that path, and does not send the user to /apps.",
        { on: turn.reply },
      )
      .label("run-with-vercel-env")
      .atLeast(0.8);
  },
});
