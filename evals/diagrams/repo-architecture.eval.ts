import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Can you map out how the app in this repo works?” — architecture overview grounded in the repo; diagram (Mermaid/SVG); don’t invent a fake app.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    // Case: map this repo’s app
    // description: User asks to map how the app in this repo works. Agent inspects the codebase, loads diagrams, and produces an overview grounded in real structure — not a generic invented architecture.
    const turn = await t.send(
      "Can you map out how the app in this repo is works.",
    );

    t.succeeded();
    turn.noFailedCalls();
    turn.notCalledTool("exa_agent_run");

    turn.calledTool("load_skill", {
      input: { skill: "diagrams" },
    });

    const producedDiagram =
      turn.toolCalls.some((call) => call.name === "render_design") ||
      turn.toolCalls.some((call) => call.name === "write_file") ||
      /```(?:mermaid|mmd)\b/i.test(turn.reply ?? "");
    if (!producedDiagram) {
      throw new Error(
        "Expected a diagram artifact (render_design, write_file, or fenced mermaid).",
      );
    }

    t.judge(
        "The reply maps how the app in this repo works as an architecture " +
          "overview: major pieces and how they connect, using names that " +
          "plausibly match this codebase (not a generic todo-app template). It " +
          "includes a diagram (Mermaid, SVG, or linked workspace file). It does " +
          "not invent services, routes, or subsystems that clearly have nothing " +
          "to do with the repo, and it does not refuse without attempting to look.",
        { on: turn.reply },
      )
      .label("repo-architecture-map")
      .atLeast(0.8);
  },
});
