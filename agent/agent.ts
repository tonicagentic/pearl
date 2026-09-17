import { defineAgent } from "eve";

// AGENT_MODEL_OVERRIDE lets experiments (evals, model comparisons) swap the
// model without editing the agent; production stays on the default.
export const DEFAULT_MODEL = "zai/glm-5.3-fast";

export default defineAgent({
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
