import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Software builder subagent.
 *
 * Creates private pearl-* GitHub repos, codes them with fx in a Vercel
 * Sandbox, and deploys them to the signed-in user's Vercel account. Declared
 * isolation: no root skills/connections/sandbox; only the tools in this
 * folder. Coding never spills into the writing sandbox.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  description:
    "Build and ship small software apps for the signed-in user. Creates private " +
    "GitHub repos named pearl-<slug>, writes and tests code with fx inside a " +
    "Vercel Sandbox, and deploys them to the user's Vercel account so they open " +
    "in Pearl's Apps viewer (web iframe / mobile WebView). Delegate when the user " +
    "asks to build, code, ship, or iterate on a mini app. Pass the goal and any " +
    "constraints in message; the child owns create_app, code_with_fx, publish_app, " +
    "and list_apps.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
