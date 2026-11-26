import { defineEval } from "eve/evals";
import {
  CAPABILITY,
  PATTERN_SUMMARY_FOR_CHOOSE,
  STRONG_SEGMENT,
} from "./fixtures/discovery.ts";

export default defineEval({
  description:
    "Market discovery choose ICP: after evidence, recommend the segment with " +
    "demonstrated demand and reachability — not the largest-sounding market.",
  tags: ["smoke"],
  timeoutMs: 300_000,
  async test(t) {
    const session = await t.session();
    const open = await session.send(CAPABILITY.promptSellTo);
    t.succeeded();
    open.notCalledTool("exa_agent_run");
    t.judge(
        "The reply proposes two or three specific candidate segments (role + " +
          "company type, not 'SMBs'), labeled as hypotheses. It asks what the offer " +
          "does or which pain it addresses if those are unknown. It does not settle " +
          "an ICP or jump to a company prospect list.",
        { on: open.reply },
      )
      .label("choose-icp-open-segments")
      .atLeast(0.8);

    const choose = await session.send(
      `Here is what I learned:\n\n${PATTERN_SUMMARY_FOR_CHOOSE}\n\n` +
        `Which starting ICP should I choose? Prioritize demonstrated demand and ` +
        `ease of reaching buyers — not just the biggest market. Propose the ICP ` +
        `fields but do not treat it as final until I confirm.`,
    );
    t.succeeded();
    choose.notCalledTool("exa_agent_run");
    t.judge(
        `The reply recommends "${STRONG_SEGMENT.label}" (or the small-logistics ` +
          `operations segment) based on demonstrated demand (interview pain + paid ` +
          `pilot interest) and reachability. It does not pick the larger-sounding ` +
          `enterprise supply-chain market that has no interview evidence. The ICP is ` +
          `still a proposal: Industry, Company size, Buyer role, and Problem are ` +
          `restated for confirmation, not locked as settled without the user saying so.`,
        { on: choose.reply },
      )
      .label("choose-icp-demand-over-size")
      .atLeast(0.8);
  },
});
