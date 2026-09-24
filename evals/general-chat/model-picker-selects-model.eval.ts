import { defineEval } from "eve/evals";

// The composer model picker's transport: a clientContext marker selects the
// model for the turn, and step.started events report the concrete modelId of
// each model call. Requires AGENT_MODEL_OVERRIDE to be unset (the override
// intentionally wins over the picker).
export default defineEval({
  description:
    "Model picker: a clientContext marker routes the turn's model calls to GPT 6 Sol.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send("Reply with the single word: ready.", {
      clientContext: { eveModelSelection: "gpt-6-sol" },
    });

    t.succeeded();

    const stepModels = t.events
      .filter((event) => event.type === "step.started")
      .map((event) => (event.data as { modelId: string }).modelId);

    if (stepModels.length === 0) {
      throw new Error("No step.started events reported for the turn.");
    }

    if (stepModels.some((modelId) => modelId !== "openai/gpt-6-sol")) {
      throw new Error(
        `Expected every model call to run on openai/gpt-6-sol, got: ${stepModels.join(", ")}`,
      );
    }
  },
});
