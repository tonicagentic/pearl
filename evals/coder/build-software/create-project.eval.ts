import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

export default defineEval({
  description:
    "“Create a new project / new app repo” — Pearl create_project and/or coder for a new GitHub app; never /apps; don’t invent URLs.",
  tags: ["smoke", "costs-coder"],
  timeoutMs: 420_000,
  async test(t) {
    // Case: create a Pearl Project
    // description: User asks to create a Pearl project for upcoming work. Agent calls create_project (may ask a name if missing — here name is given).
    const pearlProject = await t.session();
    const pearlTurn = await pearlProject.send(
      "Create a new Pearl project called Widgets Redesign for the acme/widgets " +
        "work. Short instructions: dark mode and settings cleanup.",
    );

    t.succeeded();
    pearlTurn.noFailedCalls();
    pearlTurn.calledTool("create_project");
    pearlTurn.notCalledTool("coder");

    t.judge(
        "The reply creates (or confirms creating) a Pearl project named " +
          "Widgets Redesign via create_project, with instructions touching " +
          "dark mode / settings. It does not invent a project as already " +
          "existing without the tool, and it does not send the user to /apps.",
        { on: pearlTurn.reply },
      )
      .label("create-pearl-project")
      .atLeast(0.8);

    // Case: create a new GitHub app / repo
    // description: User asks to scaffold a new app on GitHub. Parent delegates to coder.
    const newApp = await t.session();
    const newAppTurn = await newApp.send(
      "Create a new private GitHub repo and Next.js app called pulse-board " +
        "with a basic dashboard page.",
    );

    t.succeeded();
    newAppTurn.noFailedCalls();
    newAppTurn.calledTool("coder");

    t.check(
      newAppTurn.reply ?? "",
      satisfies(
        (text) =>
          !String(text).toLowerCase().includes("/apps") &&
          !String(text).toLowerCase().includes("mini-app"),
        "new-github-app: reply must not send the user to /apps or a mini-app",
      ),
    );

    t.judge(
        "The thread starts creating the pulse-board GitHub/Next.js app via " +
          "coder (delegates / says the coder is starting). It does not invent " +
          "a github.com or Vercel URL as already live, and it does not send " +
          "the user to /apps.",
        { on: newAppTurn.reply },
      )
      .label("create-github-app")
      .atLeast(0.8);
  },
});
