import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { executeSend } from "../../lib/agent/notification";

// Destructive reference tool: an external side effect (delivering a message
// through the notification endpoint). It carries the three code-level
// protections the reliability suite enforces for every destructive tool —
// see lib/agent/notification.ts and evals/README.md:
//
//   - `approval: always()` parks the run for a human decision before
//     execute() can run at all (gate in code, not prompt).
//   - The execution ledger makes replays of the same logical delivery a
//     no-op and surfaces crashes mid-delivery as `incomplete`.
//   - Private context classes are refused before anything leaves the process.
//
// NOTIFICATION_ENDPOINT (optional) is the delivery target; when unset the
// tool returns `unconfigured` with no side effect. Fault-injection tests
// point it at a stub server to inject network failures at the boundary.

export default defineTool({
  description:
    "Send a notification message to a recipient through the notification endpoint. Requires user approval; refuses private data classes.",
  inputSchema: z.object({
    recipient: z.string().min(1).describe("Where to send it (channel or address)."),
    message: z.string().min(1).describe("Message body to deliver."),
    idempotencyKey: z
      .string()
      .nullish()
      .describe("Optional stable key; retries with the same key never double-send."),
  }),
  approval: always(),
  async execute(input) {
    return executeSend(input, {
      deliver: async (endpoint, body) => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          throw new Error(`Endpoint responded ${res.status}`);
        }

        return (await res.text()).slice(0, 512) || `http-${res.status}`;
      },
    });
  },
});
