import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Software builder subagent.
 *
 * Drafts mini apps, codes them with fx in a Vercel Sandbox (no GitHub
 * required), then on publish creates pearl-* repos and deploys to the
 * signed-in user's Vercel account. Declared isolation: no root
 * skills/connections/sandbox; only the tools in this folder. Coding never
 * spills into the writing sandbox.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  // libfx loads durable/vercel.mjs via import.meta.url; durable-harness has
  // the same package-relative assets. Keep both external so eve's hosted
  // function ships the real package trees instead of a flattened bundle.
  build: {
    externalDependencies: ["libfx", "durable-harness"],
  },
  description:
    "Build and ship small software apps for the signed-in user. Registers a " +
    "draft, writes and tests code with fx inside a Vercel Sandbox (GitHub not " +
    "required until publish), then creates a private pearl-<slug> GitHub repo " +
    "and deploys to the user's Vercel account for Pearl's Apps viewer. Delegate " +
    "when the user asks to build, code, ship, or iterate on a mini app. Pass the " +
    "goal and any constraints in message; the child owns create_app, code_with_fx, " +
    "screenshot_app, publish_app, and list_apps.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
