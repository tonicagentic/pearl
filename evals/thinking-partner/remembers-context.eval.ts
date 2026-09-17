import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

export default defineEval({
  description:
    "Memory recall: facts shared in one session are used in a later session without re-asking, and the agent is transparent about saving them.",
  tags: ["smoke", "multi-session"],
  timeoutMs: 240_000,
  async test(t) {
    const first = await t.send(
      "Quick context so you know me going forward: I'm training for the Berlin Marathon in October, and I've been vegan for two years. Keep that in mind for future planning.",
    );

    first.expectOk();

    const saved = first.toolCalls.some((call) => /memory/.test(call.name));
    t.check(saved, booleanGate("memory-saved"));

    // A second, independent session must still know the context.
    const second = t.newSession();
    const followUp = await second.send(
      "I'm planning my dinners for race week — any quick thoughts?",
    );

    followUp.expectOk();

    t.judge.autoevals
      .closedQA(
        "The dinner suggestions are appropriate for a vegan runner before the Berlin Marathon (plant-based, carb-conscious, marathon-aware), and the reply does NOT ask the user to repeat that they are vegan or training for a marathon — it uses what it was told in the earlier session.",
        { on: followUp.message },
      )
      .atLeast(0.8);
  },
});
