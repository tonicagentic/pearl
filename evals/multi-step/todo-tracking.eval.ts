import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

// Gate: the todo list actually tracks both weather steps.
const todosTrackBothCities = gateAssertion("todos-track-both-cities", (value) => {
  const input = value as { todos?: Array<{ content?: string }> };
  const todos = input?.todos;

  if (!Array.isArray(todos) || todos.length < 2) {
    return 0;
  }

  const joined = todos
    .map((task) => (typeof task.content === "string" ? task.content : ""))
    .join(" ");

  return joined.includes("Tokyo") && joined.includes("Paris") ? 1 : 0;
});

// Gate for the precomputed boolean.
const trackedGate = gateAssertion("todos-tracked", (value) =>
  value === true ? 1 : 0,
);

export default defineEval({
  description:
    "Cheap multistep: the agent uses the todo tool to track a two-step task and answers using both results.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "Track this with your todo tool: check the weather in Tokyo and in Paris, then recommend which city to visit this weekend based on the forecasts.",
    );

    t.succeeded();
    t.calledTool("todo");
    t.calledTool("get_weather");
    t.toolOrder(["todo", "get_weather"]);
    t.noFailedActions();

    const todoCalls = turn.toolCalls.filter((call) => call.name === "todo");
    const tracked = todoCalls.some((call) =>
      todosTrackBothCities.score(call.input) === 1,
    );

    t.check(tracked, trackedGate);

    t.judge.autoevals.closedQA(
      "The recommendation references the actual weather results for both Tokyo and Paris before recommending one.",
      { on: turn.message },
    );
  },
});
