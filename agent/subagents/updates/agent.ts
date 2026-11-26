import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Briefing / catch-me-up specialist.
 *
 * Declared under `subagents/updates/` — inherits none of the root's skills or
 * tools. Mounts read-only Calendar + Xero, first-party mail reads,
 * web_search, and public X search. Personal X timeline Connect is
 * catalogued as coming soon.
 *
 * The parent packs the brief (surfaces, time window, topics) into `message`;
 * continue with `taskId`. Inbox triage/replies stay on `mail`; deep research
 * on `researcher`; books mutations never happen here.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  description:
    "Produce a short update summary across the user's world: news and " +
    "headlines, unread or important mail, calendar for the next window, " +
    "finance snapshot from Xero when connected, and public X/Twitter " +
    "discussion. Delegate for 'catch me up', daily/morning brief, 'what's " +
    "new', news digests, or cross-surface status — not for inbox " +
    "triage/replies (mail), deep fact research (researcher), prospecting " +
    "(list-builder), shipping code (coder), or ops health (coder / Better " +
    "Stack). Pass which surfaces matter, time window, and topics in " +
    "message; the child does not see this thread.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
