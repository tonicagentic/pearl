import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "Expo / EAS asks (list projects, start iOS build) → coder (Profile → Coder → Expo); never invent a build URL; never /apps.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 420_000,
  async test(t) {
    // Case: list Expo projects
    // description: User asks what Expo projects they have. Parent delegates to coder (Expo lives on coder); or guides to Profile → Coder → Expo.
    const list = await t.session();
    const listTurn = await list.send(
      "What Expo projects do I have? List them for me.",
    );

    t.succeeded();
    listTurn.noFailedCalls();
    listTurn.calledTool("coder");

    t.judge(
        "The thread starts listing Expo projects via coder (delegates / says " +
          "the coder is starting), or the coder path reports Expo is not " +
          "connected and points at Profile → Coder → Expo. It does not invent " +
          "a list of Expo appIds / @owner/slugs as the user's, and it does not " +
          "send them to /apps.",
        { on: listTurn.reply },
      )
      .label("list-expo-projects")
      .atLeast(0.8);

    // Case: start EAS iOS build
    // description: User asks to start an EAS iOS build for a named mobile repo. Parent delegates to coder.
    const build = await t.session();
    const buildTurn = await build.send(
      "Start an EAS iOS build for the Expo app in my GitHub repo acme/mobile.",
    );

    t.succeeded();
    buildTurn.noFailedCalls();
    buildTurn.calledTool("coder");

    const reply = buildTurn.reply ?? "";
    t.check(
      reply,
      satisfies(
        (text) =>
          !String(text).toLowerCase().includes("/apps") &&
          !String(text).toLowerCase().includes("mini-app"),
        "eas-ios-build: reply must not send the user to /apps or a mini-app",
      ),
    );

    t.judge(
        "The thread starts an EAS iOS build path for acme/mobile via coder " +
          "(delegates / says the coder is starting). It does not claim a " +
          "TestFlight or build URL that no tool returned, and it does not send " +
          "the user to /apps.",
        { on: buildTurn.reply },
      )
      .label("eas-ios-build")
      .atLeast(0.8);
  },
});
