import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: 1024 iOS App Store icon for Pearl → calledAgent designer; vector mark path, no invented CDN URL.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Create a finished 1024×1024 iOS App Store icon for Pearl — a clean " +
        "vector mark suitable for the App Store. Produce the SVG/file; do " +
        "not invent a download link.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread routes a finished Pearl App Store icon to the designer " +
        "subagent (delegates / says the designer is starting). It does not " +
        "invent an App Store Connect or CDN URL as already published, and it " +
        "does not treat a random stock photo as the settled app icon without " +
        "producing a file.",
      { on: turn.reply },
    )
      .label("ios-app-icon")
      .atLeast(0.8);
  },
});
