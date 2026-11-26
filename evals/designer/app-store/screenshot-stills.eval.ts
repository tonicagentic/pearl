import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Designer contract: iPhone marketing stills for App Store → calledAgent designer; no invented screenshot URLs.",
  tags: ["smoke", "subagent", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const turn = await t.send(
      "Produce three finished iPhone marketing stills for Pearl's App Store " +
        "listing — device-framed product shots we can upload. Share real " +
        "file/tool URLs only.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.calledAgent("designer");

    t.judge(
      "The thread starts App Store marketing stills via the designer " +
        "subagent. It does not invent Expo simulator, TestFlight, or CDN " +
        "screenshot URLs that no tool returned.",
      { on: turn.reply },
    )
      .label("screenshot-stills")
      .atLeast(0.8);
  },
});
