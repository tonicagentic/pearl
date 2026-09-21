import { defineAgent } from "eve";

import { DEFAULT_MODEL } from "../../agent.ts";

// Specialist reviewer: grades a written work the parent hands over and
// returns structured feedback. It deliberately cannot write files — revisions
// stay with the parent agent, which applies them with edit_file after the
// author picks what to apply.
export default defineAgent({
  description:
    "Grade and critique a written work (blog post, essay, technical narrative) for logical coherence, whole-piece flow, and audience fit, plus a factual house-style audit against the agent's voice rules. Returns structured feedback with scores, an argument map, prioritized revisions, and style violations. Delegate when the user asks for a review of a draft, or before applying revisions to a file the user is iterating on.",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
