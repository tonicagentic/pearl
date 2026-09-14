import { defineEval } from "eve/evals";
import { gateAssertion } from "#evals/assertions.js";

// Gate: at least one todo call captured the full campaign, including an
// email-writing step.
const todosTrackEmailStep = gateAssertion("todos-track-email-step", (value) => {
  const input = value as { todos?: Array<{ content?: string }> };
  const todos = input?.todos;

  if (!Array.isArray(todos) || todos.length === 0) {
    return 0;
  }

  return todos.some(
    (task) =>
      typeof task.content === "string" && /email/i.test(task.content),
  )
    ? 1
    : 0;
});

// Gate: the exa_agent_run result contains a companies list.
const leadListStructured = gateAssertion("exa-lead-list-structured", (value) => {
  const out = value as {
    output?: { structured?: { companies?: Array<Record<string, unknown>> } };
  };
  const companies = out?.output?.structured?.companies;

  return Array.isArray(companies) && companies.length > 0 ? 1 : 0;
});

// Boolean gates for the precomputed checks (the input/output-scoring
// assertions above are used to compute these, not applied to them).
const booleanGate = (name: string) =>
  gateAssertion(name, (value) => (value === true ? 1 : 0));

export default defineEval({
  description:
    "Full multistep campaign: build 10 leads with exa_agent_run, tracked via the todo tool, then write a personalized cold email per lead.",
  tags: ["costs-exa"],
  timeoutMs: 600_000,
  async test(t) {
    const turn = await t.send(
      "Use your todo tool to track this campaign: first use exa_agent_run with the leads preset to build a lead list of 10 AI infrastructure startups in San Francisco (maxItems 10, effort low), then write a short personalized cold email for each lead directly in your reply.",
    );

    t.succeeded();
    t.calledTool("todo");
    t.calledTool("exa_agent_run");
    t.toolOrder(["todo", "exa_agent_run"]);
    t.noFailedActions();

    const todoCalls = turn.toolCalls.filter((call) => call.name === "todo");
    const tracked = todoCalls.some(
      (call) => todosTrackEmailStep.score(call.input) === 1,
    );
    t.check(tracked, booleanGate("todos-track-email-step"));

    const runCalls = turn.toolCalls.filter(
      (call) => call.name === "exa_agent_run",
    );
    const saved = runCalls.some(
      (call) => leadListStructured.score(call.output) === 1,
    );
    t.check(saved, booleanGate("exa-lead-list-structured"));

    t.judge.autoevals.closedQA(
      "The answer contains a personalized cold email for each lead, each mentioning the company or its product by name, roughly matching the number of leads requested.",
      { on: turn.message },
    );
  },
});
