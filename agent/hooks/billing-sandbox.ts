import { defineHook } from "eve/hooks";

import { noteSandboxStopped } from "@/lib/billing/sandbox-meter";

/**
 * Close out writing/coder sandbox meters when the session ends. Do not stop
 * the sandbox between turns — Pearl keeps draft files alive for the session.
 */
export default defineHook({
  events: {
    async "session.ended"(_event, ctx) {
      try {
        const sandbox = await ctx.getSandbox();
        await sandbox.stop();
      } catch {
        // No sandbox or already stopped.
      }

      try {
        await noteSandboxStopped({ sandboxId: `writing:${ctx.session.id}` });
        await noteSandboxStopped({ sandboxId: `coder:${ctx.session.id}` });
      } catch (error) {
        console.error("[billing-sandbox] session.ended", error);
      }
    },
  },
});
