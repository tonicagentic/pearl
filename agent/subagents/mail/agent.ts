import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Inbox triage specialist across connected Gmail accounts.
 *
 * Declared subagent — inherits none of the root's tools or connections.
 * Mounts its own Gmail connections and batch/rule tools. The parent
 * delegates unread / triage / archive work here and continues with taskId.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  description:
    "Triage and manage the user's Gmail across every connected account: " +
    "summarize unread, cluster noise, propose archive/mark-read batches, " +
    "apply saved rules, and draft replies. Delegate for inbox cleanup, " +
    "unread counts, 'what needs a reply', and multi-account mail work. " +
    "One-off lookups of a single known thread can stay on the root Gmail " +
    "connection. The child does not see this conversation — pass accounts, " +
    "goals, and constraints in the message.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
