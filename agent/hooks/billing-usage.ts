import { defineHook } from "eve/hooks";
import { call } from "eve/events";

import { isBillingActive } from "@/lib/billing/accounts";
import { WEB_SEARCH_FALLBACK_CENTS } from "@/lib/billing/config";
import { recordUsage, usdToCents } from "@/lib/billing/ledger";

/**
 * Server-side usage ledger from eve's usage.recorded events. Covers every
 * channel (web, mobile, schedules). Parent rollups that restate delegated
 * spend are skipped so subagents are not double-counted.
 */
export default defineHook({
  events: {
    async "call.settled"(event, ctx) {
      try {
        if (!(await isBillingActive())) {
          return;
        }
        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        if (!principalId) {
          return;
        }

        const settled = call(ctx.view, event.data.callId);
        const name = settled?.name;
        if (name !== "web_search") {
          return;
        }

        await recordUsage({
          idempotencyKey: `web_search:${event.data.callId}`,
          userId: principalId,
          source: "web_search",
          costCents: WEB_SEARCH_FALLBACK_CENTS,
          metadata: { callId: event.data.callId },
        });
      } catch (error) {
        console.error("[billing-usage] call.settled", error);
      }
    },

    async "usage.recorded"(event, ctx) {
      try {
        if (!(await isBillingActive())) {
          return;
        }

        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        if (!principalId) {
          return;
        }

        const data = event.data as {
          readonly kind?: string;
          readonly costUsd?: number;
          readonly inputTokens?: number;
          readonly outputTokens?: number;
          readonly cacheReadTokens?: number;
          readonly cacheWriteTokens?: number;
          readonly modelId?: string;
          readonly owner?: { readonly runId?: string; readonly callId?: string };
        };

        // Parent rollups of delegated spend: kind "delegated-late" or an
        // owner.callId without a fresh run. Bill only per-run records.
        if (data.kind === "delegated-late") {
          return;
        }
        if (data.owner?.callId && !data.owner?.runId) {
          // Aggregated child spend attributed back to a tool call.
          return;
        }

        const costCents = usdToCents(data.costUsd);
        if (costCents <= 0 && !data.inputTokens && !data.outputTokens) {
          return;
        }

        const runKey =
          data.owner?.runId ??
          `${ctx.session.id}:${event.type}:${ctx.position.line}:${ctx.position.index}`;

        await recordUsage({
          idempotencyKey: `model:${runKey}`,
          userId: principalId,
          source: "model",
          costCents,
          metadata: {
            modelId: data.modelId ?? null,
            inputTokens: data.inputTokens ?? null,
            outputTokens: data.outputTokens ?? null,
            cacheReadTokens: data.cacheReadTokens ?? null,
            cacheWriteTokens: data.cacheWriteTokens ?? null,
            sessionId: ctx.session.id,
            kind: data.kind ?? null,
          },
        });
      } catch (error) {
        console.error("[billing-usage] usage.recorded", error);
      }
    },
  },
});
