import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“How can I build my reputation in the tech industry?” — strategy: a few concrete focus options as hypotheses; not a generic hustle listicle or lead list.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: tech reputation strategy
    // description: User asks how to build reputation in tech. Agent offers a short strategy with concrete focus options / tradeoffs; may clarify niche or goals; no invented credentials or prospect list.
    const turn = await t.send(
      "How can I build my repuation in the tech industry",
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("write_file");

    t.judge(
        "The reply treats this as a strategy question: it offers a few concrete " +
          "focus options or levers for building reputation in tech (e.g. shipping " +
          "visible work, writing/speaking, open source, niche expertise — whatever " +
          "fits) with enough tradeoff or sequencing to choose among, not a long " +
          "generic hustle listicle. It may ask what kind of reputation or niche " +
          "they care about. It does not invent credentials, followers, or named " +
          "won outcomes as facts, and it does not start a company prospect list.",
        { on: turn.reply },
      )
      .label("tech-reputation-strategy")
      .atLeast(0.8);
  },
});
