import { readFile } from "node:fs/promises";
import { gateAssertion } from "#evals/assertions.js";
import { defineEval } from "eve/evals";

// Two-image comprehension: the reply must keep the two dashboards separate
// and attribute the right status/region/warnings to each.
export default defineEval({
  description:
    "Multi-image compare: two deploy dashboards attached; the reply attributes status, region, and warnings to the correct one of each.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const green = await readFile(
      "evals/thinking-partner/fixtures/screenshot.png",
    );
    const yellow = await readFile(
      "evals/attachments/fixtures/deploy-yellow.png",
    );

    const turn = await t.send([
      {
        type: "text",
        text: "Here are two deploy dashboards. For each one, tell me the deploy status, the region, and the warning count. Label them first and second in the order I attached them.",
      },
      {
        type: "file",
        data: `data:image/png;base64,${green.toString("base64")}`,
        mediaType: "image/png",
      },
      {
        type: "file",
        data: `data:image/png;base64,${yellow.toString("base64")}`,
        mediaType: "image/png",
      },
    ]);

    turn.expectOk();

    // Statuses case-insensitively: the agent may write "green" or "GREEN".
    const bothStatuses = gateAssertion(
      "both-statuses-mentioned",
      (value) => {
        const msg = typeof value === "string" ? value : "";
        return /green/i.test(msg) && /yellow/i.test(msg) ? 1 : 0;
      },
    );
    t.check(turn.message, bothStatuses);

    t.judge.autoevals
      .closedQA(
        "The reply attributes the FIRST attached dashboard as GREEN / eu-central-1 / 3 warnings and the SECOND as YELLOW / us-east-2 / 1 warning — statuses, regions, and warning counts are not mixed between the two images.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});
