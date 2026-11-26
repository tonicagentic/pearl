import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Cursor-style ship asks (change a repo, preview deploy, new app, investigate a bug) → delegate to coder; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 420_000,
  async test(t) {
    const cases = [
      {
        name: "change-in-repo",
        // description: User asks for a concrete change in a GitHub repo. Parent delegates to coder.
        prompt:
          "In my GitHub repo acme/widgets, add a README section titled " +
          "Contributing with a one-paragraph contribution guide.",
        judge:
          "The thread starts coding work on acme/widgets for a Contributing " +
          "README section (delegates to coder / says the coder is starting). " +
          "It does not write the app source into the chat writing sandbox as " +
          "the implementation, and it does not send the user to /apps.",
      },
      {
        name: "preview-deploy",
        // description: User asks to deploy a Vercel preview for a repo. Parent delegates to coder.
        prompt:
          "Deploy a Vercel preview for my Next.js app in the GitHub repo " +
          "acme/widgets.",
        judge:
          "The thread starts a preview deploy path for acme/widgets via coder " +
          "(delegates / says the coder is starting). It does not claim a " +
          "preview URL that no tool returned, and it does not send the user " +
          "to /apps.",
      },
      {
        name: "new-app",
        // description: User asks to create a new app. Parent delegates to coder with create-one style repo.
        prompt:
          "Create a new private Next.js app called hello-pearl with a simple " +
          "hello page and put it on GitHub.",
        judge:
          "The thread starts creating the hello-pearl app via coder (delegates " +
          "/ says the coder is starting). It does not pretend the app already " +
          "exists with a fake URL, and it does not send the user to /apps.",
      },
      {
        name: "investigate-bug",
        // description: User asks to investigate and fix a bug in a repo. Parent delegates to coder.
        prompt:
          "Something's wrong with the login flow in my GitHub repo " +
          "acme/widgets — can you investigate and fix it?",
        judge:
          "The thread starts investigation/fix work on acme/widgets via " +
          "coder (delegates / says the coder is starting). It does not invent " +
          "a root cause and patched files as already done without coder, and " +
          "it does not send the user to /apps.",
      },
    ] as const;

    for (const testCase of cases) {
      const session = await t.session();
      const turn = await session.send(testCase.prompt);

      t.succeeded();
      turn.calledTool("coder");
      turn.noFailedCalls();

      const reply = turn.reply ?? "";
      t.check(
        reply,
        satisfies(
          (text) =>
            !String(text).toLowerCase().includes("/apps") &&
            !String(text).toLowerCase().includes("mini-app"),
          `${testCase.name}: reply must not send the user to /apps or a mini-app`,
        ),
      );

      t.judge(testCase.judge, { on: turn.reply })
        .label(testCase.name)
        .atLeast(0.8);
    }
  },
});
