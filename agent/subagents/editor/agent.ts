import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

// Specialist reviewer: grades a written work the parent hands over and
// returns structured feedback. It deliberately cannot write files — revisions
// stay with the parent agent, which applies them with edit_file after the
// author picks what to apply.
export default defineAgent({
  // Same checkpoint batching as the root (docs: checkpoint-optimization-plan.md).
  experimental: WORKFLOW_BATCHING,
  description:
    "Grade and critique the reasoning of a written work (blog post, essay, technical narrative): logical coherence, whole-piece flow, and audience fit, plus a factual house-style audit. Returns structured feedback with scores, an argument map, prioritized revisions, and style violations. Delegate when the concern is whether the argument lands, the structure holds, or the audience is served. For the routine pre-publication style pass on a channel draft (voice drift, AI-tells, format specs), delegate to the reviewer subagent instead.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
