import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * Pearl must route coding requests to the `coder` subagent and must not send
 * users to the retired `/apps` surface.
 */
export default defineEval({
  description:
    "Coding requests delegate to coder (new app, repo change, Vercel deploy, " +
    "iOS build) and replies do not send the user to /apps.",
  tags: ["reliability", "nightly"],
  timeoutMs: 300_000,
  async test(t) {
    const cases = [
      {
        name: "new-app",
        prompt:
          "Build a new private Next.js app called hello-pearl with a simple " +
          "hello page. Do not ask clarifying questions — start the coding " +
          "work now by calling the coder tool.",
      },
      {
        name: "repo-change",
        prompt:
          "In my GitHub repo acme/widgets, add a README section titled " +
          "'Contributing'. Do not ask clarifying questions — call the coder " +
          "tool now with that goal.",
      },
      {
        name: "vercel-deploy",
        prompt:
          "Deploy my Next.js checkout in acme/widgets to a Vercel preview. " +
          "Do not ask clarifying questions — call the coder tool now.",
      },
      {
        name: "ios-build",
        prompt:
          "Start an Expo EAS iOS build for the app in acme/mobile. Do not ask " +
          "clarifying questions — call the coder tool now.",
      },
    ] as const;

    for (const testCase of cases) {
      const turn = await t.send(testCase.prompt);
      t.succeeded();
      t.calledTool("coder");
      t.noFailedCalls();

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
    }
  },
});
