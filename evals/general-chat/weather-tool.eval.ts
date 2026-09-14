import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Weather question: the agent calls the get_weather tool for the city and reports condition and temperature.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send("What's the weather in Tokyo right now?");

    t.succeeded();
    t.calledTool("get_weather", { input: { city: "Tokyo" } });

    t.judge.autoevals.closedQA(
      "The answer reports a weather condition and a temperature for Tokyo.",
      { on: turn.message },
    );
  },
});
