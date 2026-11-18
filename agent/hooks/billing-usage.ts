import { defineHook } from "eve/hooks";
import { call } from "eve/events";

import { isBillingActive } from "@/lib/billing/accounts";
import { recordUsage } from "@/lib/billing/ledger";
import {
  exaSearchMicros,
  microsToUsd,
  usdToMicros,
} from "@/lib/billing/provider-pricing";

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

        // Default eve / Pearl web_search is Exa via AI Gateway. Prefer a
        // reported dollar cost on the tool result when present; otherwise use
        // Exa's published auto/instant rates.
        const output = settled?.output as
          | {
              readonly costDollars?: unknown;
              readonly costUsd?: unknown;
              readonly type?: unknown;
              readonly numResults?: unknown;
              readonly results?: unknown;
            }
          | undefined;
        const reported =
          typeof output?.costUsd === "number"
            ? output.costUsd
            : typeof output?.costDollars === "number"
              ? output.costDollars
              : output?.costDollars &&
                  typeof output.costDollars === "object" &&
                  typeof (output.costDollars as { total?: unknown }).total ===
                    "number"
                ? (output.costDollars as { total: number }).total
                : null;
        const searchType =
          typeof output?.type === "string" ? output.type : "auto";
        const numResults =
          typeof output?.numResults === "number"
            ? output.numResults
            : Array.isArray(output?.results)
              ? output.results.length
              : null;
        const micros =
          typeof reported === "number" && reported > 0
            ? usdToMicros(reported)
            : exaSearchMicros({ type: searchType, numResults });

        await recordUsage({
          idempotencyKey: `web_search:${event.data.callId}`,
          userId: principalId,
          source: "web_search",
          costMicros: micros,
          metadata: {
            callId: event.data.callId,
            provider: "exa",
            searchType,
            numResults,
            pricing:
              typeof reported === "number" && reported > 0
                ? "provider"
                : "exa_list",
            costUsd: microsToUsd(micros),
            costMicros: micros,
          },
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
          readonly usage?: {
            readonly costUsd?: number;
            readonly inputTokens?: number;
            readonly outputTokens?: number;
            readonly cacheReadTokens?: number;
            readonly cacheWriteTokens?: number;
          };
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

        // Current eve nests tokens under `data.usage`; accept a flat payload
        // too in case an older/compat emitter still inlines the fields.
        const usage = data.usage ?? data;
        const costUsd =
          typeof usage.costUsd === "number" && Number.isFinite(usage.costUsd)
            ? usage.costUsd
            : 0;
        if (costUsd <= 0 && !usage.inputTokens && !usage.outputTokens) {
          return;
        }

        const runKey =
          data.owner?.runId ??
          `${ctx.session.id}:${event.type}:${ctx.position.line}:${ctx.position.index}`;

        await recordUsage({
          idempotencyKey: `model:${runKey}`,
          userId: principalId,
          source: "model",
          costUsd,
          metadata: {
            modelId: data.modelId ?? null,
            inputTokens: usage.inputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            cacheReadTokens: usage.cacheReadTokens ?? null,
            cacheWriteTokens: usage.cacheWriteTokens ?? null,
            sessionId: ctx.session.id,
            kind: data.kind ?? null,
            costUsd,
          },
        });
      } catch (error) {
        console.error("[billing-usage] usage.recorded", error);
      }
    },
  },
});
