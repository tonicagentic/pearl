import { defineEval } from "eve/evals";

const GTM_SKILLS = [
  "gtm",
  "offer-discovery",
  "market-positioning",
  "pricing-and-terms",
  "outreach-and-messaging",
  "events-and-meetings",
] as const;

export default defineEval({
  description:
    "GTM routing: a writing request loads no gtm skill; a vague go-to-market " +
    "request loads the gtm director and clarifies instead of inventing an ICP " +
    "or price; a cold-email request loads outreach-and-messaging, drafts " +
    "without sending, and does not run market research.",
  tags: ["smoke", "reliability"],
  timeoutMs: 300_000,
  async test(t) {
    const writing = await t.send(
      "Draft a three-paragraph blog post about why durable agents matter. " +
        "Write it to a workspace file. Do not load any go-to-market skills.",
    );
    t.succeeded();
    for (const skill of GTM_SKILLS) {
      writing.calledSkill(skill, { count: 0 });
    }

    const vague = await t.send(
      "I want to start selling my consulting work but I'm not sure what my " +
        "offer is or who to sell to. Help me figure out my go-to-market. " +
        "Don't research anything yet.",
    );
    t.succeeded();
    vague.calledSkill("gtm", { count: 1 });
    vague.notCalledTool("exa_agent_run");
    vague.notCalledTool("send_gmail_message");
    t.judge(
      "The reply asks one or two clarifying questions about the user's offer " +
        "or buyer, and does not invent an ICP, price, customer, or result for " +
        "the user as if settled.",
      { on: vague.reply },
    );

    const outreach = await t.send(
      "Write a short cold email to a head of platform at a mid-size fintech " +
        "about my consulting on durable AI agents. Put it in a workspace file. " +
        "Do not send it and do not research anything.",
    );
    t.succeeded();
    outreach.calledSkill("outreach-and-messaging", { count: 1 });
    outreach.notCalledTool("exa_agent_run");
    outreach.notCalledTool("send_gmail_message");
    t.judge(
      "The reply presents or links an unsent draft, does not claim the email " +
        "was sent, and does not invent customers, results, or personal " +
        "details about the recipient.",
      { on: outreach.reply },
    );
  },
});
