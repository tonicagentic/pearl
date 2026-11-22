import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“How should we position this for that buyer?” — get an ICP/positioning draft as hypotheses, not a lead list.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      `Here is my offer and the segment I want to position for:\n\n` +
        `Offer\nKind: general offer\nName: maintenance monitoring\n` +
        `What it does: catches compressor failure before a shutdown\n` +
        `Pain: unplanned compressor downtime\n\n` +
        `Segment: industrial refrigeration plants, 80–200 employees, VP of operations.\n\n` +
        `Draft positioning and an ICP for that segment. Mark inferred fields as ` +
        `hypotheses. Do not build a company lead list and do not invent customers, ` +
        `prices, or win rates.`,
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");
    turn.calledSkill("market-positioning", { count: 1 });

    t.judge(
        "The reply drafts positioning and/or ICP fields for industrial " +
          "refrigeration / VP of operations around compressor downtime, labels " +
          "inferred claims as hypotheses (not settled facts), does not invent " +
          "named customers or numeric win rates as facts, and does not present a " +
          "company lead list to email.",
        { on: turn.reply },
      )
      .label("positioning-as-hypotheses")
      .atLeast(0.8);
  },
});
