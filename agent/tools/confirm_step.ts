import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Approval-only reference tool: no network, filesystem, or notification side
// effect. Use it to exercise the durable HITL pause — `approval: always()`
// parks the run for Allow/Deny before execute can run. On Allow, execute only
// echoes the summary back; Deny never reaches execute.

export default defineTool({
  description:
    "Ask the user to confirm a step via the durable approval UI. Call when the user asks to confirm, approve, or test an approval. Pass a one-line summary of the decision. Do not also ask for the same confirmation in prose — the runtime shows Allow/Deny.",
  inputSchema: z.object({
    summary: z
      .string()
      .min(1)
      .describe("One-line summary of the step the user is confirming."),
  }),
  approval: always(),
  async execute(input) {
    return { confirmed: true as const, summary: input.summary };
  },
});
