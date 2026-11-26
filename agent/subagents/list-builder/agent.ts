import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * GTM list and company-research specialist.
 *
 * Declared under `subagents/list-builder/` — inherits none of the root's
 * skills or tools. Owns offer/ICP clarification, market discovery, scored
 * company lists, and cited company deep dives via Exa. The parent packs the
 * brief into `message`; continue with `taskId`.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  description:
    "Go-to-market research specialist: clarify offer and ICP, discover " +
    "candidate segments, qualify ICPs, build scored company lists, and " +
    "produce cited company deep dives. Uses Exa for multi-step list and " +
    "market research and returns workspace deliverables with verified " +
    "citations. Delegate when the user is sales prospecting, building lead " +
    "lists, sizing or mapping a market, or researching a named company — " +
    "not for pricing, outreach drafts, CRM updates, or general writing " +
    "fact-checks (use researcher). Pass offer, ICP, constraints, and any " +
    "known context in message; the child does not see this thread.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
