import { defineHook } from "eve/hooks";

import { checkEgress } from "@/lib/privacy/redact";

/**
 * Refuse third-party egress when the tool/agent input carries private context
 * (health, financial, credentials, identifiers). Covers search/fetch/exa/browser
 * and the coder subagent message.
 */
const EGRESS_CAPABILITIES = new Set([
  "web_search",
  "web_fetch",
  "exa_agent_run",
  "browser",
  "coder",
  "designer",
  "list-builder",
  "updates",
  "search_x",
]);

export default defineHook({
  events: {
    async "call.requested"(event, ctx) {
      try {
        const data = event.data as {
          readonly capability?: { readonly kind?: string; readonly name?: string };
          readonly input?: unknown;
        };
        const name = data.capability?.name;
        if (!name || !EGRESS_CAPABILITIES.has(name)) {
          return;
        }

        const payload = JSON.stringify(data.input ?? "");
        const result = checkEgress(payload);
        if (!result.ok) {
          ctx.cancel(result.reason);
        }
      } catch (error) {
        console.error("[privacy-egress] call.requested", error);
      }
    },
  },
});
