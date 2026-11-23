import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What’s the most important thing to focus on when I’m pitching Pearl to someone?” — sharp pitch focus for Pearl; clarify who/context if thin; no feature dump or lead list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: Pearl pitch focus
    // description: User asks what to focus on when pitching Pearl, with no audience named. Agent gives a sharp focus (or clarifies who) as hypothesis — not a feature laundry list or prospect list.
    const turn = await t.send(
      "what's the most important thing to focus on when I'm pitching Pearl to someone",
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.notCalledTool("web_search");

    t.judge(
        "The reply helps with pitching Pearl specifically. Because 'someone' is " +
          "unspecified, it either asks who they are pitching (role / context) or " +
          "states a provisional focus as a hypothesis tied to the listener's " +
          "problem or outcome — not a long feature list. It does not invent won " +
          "customers, prices, or win rates as facts, and it does not start a " +
          "company lead list.",
        { on: turn.reply },
      )
      .label("pearl-pitch-focus")
      .atLeast(0.8);
  },
});
