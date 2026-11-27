import { defineEval } from "eve/evals";

// Genre arc: waterwheel / creek → drop height vs flow → doubled flow →
// pipe/pressure → tapering pipe. Knowledge-first; no citation theater.
export default defineEval({
  description:
    "5–6 turn mechanism deepen: waterwheel metaphor → drop vs flow → " +
    "doubled flow → pipe analogy → tapering. Consistent mechanism; no search spam.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "Explain how a waterwheel gets power from a creek — like I'm curious, " +
        "not writing a paper. No citations.",
    );
    open.expectOk();
    open.notCalledTool("web_search");
    open.notCalledTool("exa_agent_run");
    t.judge(
        "The reply explains waterwheel power from a creek in clear mechanism " +
          "language (water moving the wheel / energy transfer). No fabricated " +
          "papers or URLs. Educational, not a product pitch.",
        { on: open.reply },
      )
      .label("metaphor-waterwheel")
      .atLeast(0.8);

    const drop = await session.send(
      "Which matters more for power — how high the water drops, or how much " +
        "water is flowing?",
    );
    drop.expectOk();
    drop.notCalledTool("web_search");
    drop.notCalledTool("exa_agent_run");
    t.judge(
        "The reply addresses drop height vs flow rate in the waterwheel/" +
          "creek vocabulary already in play, and is directionally sound " +
          "(power relates to both head and flow). No citation theater.",
        { on: drop.reply },
      )
      .label("metaphor-drop-vs-flow")
      .atLeast(0.8);

    const doubled = await session.send(
      "If we doubled the flow but kept the drop the same, what roughly happens " +
        "to the power?",
    );
    doubled.expectOk();
    doubled.notCalledTool("web_search");
    doubled.notCalledTool("exa_agent_run");
    t.judge(
        "The reply builds on the prior drop/flow framing: doubled flow at " +
          "same head roughly doubles available power (or states the " +
          "proportional relationship clearly). Stays in shared vocabulary; " +
          "no fabricated citations.",
        { on: doubled.reply },
      )
      .label("metaphor-doubled-flow")
      .atLeast(0.8);

    const pipe = await session.send(
      "Can you shift the analogy to a pipe — how does pressure fit where " +
        "“drop height” was?",
    );
    pipe.expectOk();
    pipe.notCalledTool("web_search");
    pipe.notCalledTool("exa_agent_run");
    t.judge(
        "The reply maps drop height to pressure (or head) in a pipe analogy " +
          "consistent with the prior power/flow discussion. Clear mechanism; " +
          "no citation spam.",
        { on: pipe.reply },
      )
      .label("metaphor-pipe-pressure")
      .atLeast(0.8);

    const taper = await session.send(
      "What if the pipe tapers narrower — what happens to flow and pressure " +
        "along that taper, still in the same picture?",
    );
    taper.expectOk();
    taper.notCalledTool("web_search");
    taper.notCalledTool("exa_agent_run");
    t.judge(
        "The reply stays inside the shared pipe/pressure/flow picture: " +
          "narrowing affects speed and pressure in a coherent way (continuity / " +
          "Bernoulli-level intuition is fine). No invented papers; no tool spam.",
        { on: taper.reply },
      )
      .label("metaphor-taper")
      .atLeast(0.75);
  },
});
