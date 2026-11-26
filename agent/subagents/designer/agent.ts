import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Fresh-context visual design subagent.
 *
 * Declared under `subagents/designer/` — inherits none of the root's skills,
 * tools, or connections. The parent packs the brief (product, audience, brand
 * hints, sizes, platform) into `message`; this child loads design skills and
 * produces workspace artifacts via generate_image / generate_svg /
 * render_design / write_file.
 *
 * Art direction and thin concept chats can stay on Pearl; finished asset packs
 * (App Store, social sizes, print PDFs, product shots) delegate here.
 */
export default defineAgent({
  experimental: WORKFLOW_BATCHING,
  description:
    "Create and iterate finished visual deliverables in the session " +
    "workspace: iOS App Store icons and marketing stills, social post " +
    "graphics at specified sizes, product/hero images via generate_image, " +
    "vector marks and icon sets via generate_svg / write_file, and " +
    "print-ready PDFs via print-design + render_design. Delegate when the " +
    "user wants produced assets (not only art direction). Pass product " +
    "name, audience, brand colors/type hints, required sizes, and platform " +
    "(iOS App Store, LinkedIn, X, etc.) in message; continue with taskId. " +
    "The child does not see this thread.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
