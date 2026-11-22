import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Plan a short trip to X on these dates” — check weather, then a concise weather-aware itinerary.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Plan a 2-day trip to Tokyo next weekend. Keep it short — a few bullets " +
        "per day. Check the weather first and fit outdoor vs indoor activities to it.",
    );

    t.succeeded();
    turn.calledTool("get_weather", { input: { city: "Tokyo" } });
    turn.noFailedCalls();

    t.judge(
        "The reply gives a short 2-day Tokyo itinerary (a few bullets per day) " +
          "that reflects weather (outdoor when clear/good, indoor alternatives " +
          "when not). It does not invent impossible weather or dump an essay.",
        { on: turn.reply },
      )
      .label("weather-aware-itinerary")
      .atLeast(0.8);
  },
});
