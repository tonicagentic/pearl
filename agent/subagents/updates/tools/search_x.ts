import { randomUUID } from "node:crypto";

import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  blockMessage,
  WEB_SEARCH_FALLBACK_CENTS,
} from "@/lib/billing/config";
import { assertCanSpend, recordUsage } from "@/lib/billing/ledger";
import { principalIdFromAuth } from "@/lib/billing/principal";
import { exaSearchMicros } from "@/lib/billing/provider-pricing";

/**
 * Public X / Twitter discussion via Exa Search, scoped to x.com / twitter.com.
 * Personal timeline Connect is coming soon — this is not the user's feed.
 */

const SEARCH_URL = "https://api.exa.ai/search";
const X_DOMAINS = ["x.com", "twitter.com"] as const;

type ExaSearchHit = {
  readonly title?: string;
  readonly url?: string;
  readonly publishedDate?: string;
  readonly author?: string;
  readonly text?: string;
};

type ExaSearchResponse = {
  readonly results?: readonly ExaSearchHit[];
  readonly requestId?: string;
};

function exaApiKey(): string | null {
  return process.env.EXA_API_KEY?.trim() || null;
}

const tool = defineTool({
  description:
    "Search public posts and discussion on X (Twitter) about a topic or " +
    "handle. Returns cited open-web / indexed results from x.com and " +
    "twitter.com — not the signed-in user's personal timeline, DMs, or " +
    "following feed (Connect for that is coming soon). Prefer this over " +
    "generic web_search when the user asks what people are saying on X.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural-language question or keywords. Include handles without @ " +
          "when scoping to accounts (e.g. 'vercel launch from vercel').",
      ),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(20)
      .nullish()
      .describe("How many results to return (default 8, max 20)."),
  }),
  async execute(input, ctx) {
    const apiKey = exaApiKey();
    if (!apiKey) {
      return {
        ok: false as const,
        error:
          "search_x needs EXA_API_KEY. Fall back to web_search with an " +
          "X/Twitter-focused query, or tell the user search is unavailable.",
      };
    }

    const query = input.query.trim();
    if (!query) {
      return { ok: false as const, error: "query is required." };
    }

    const numResults = input.numResults ?? 8;
    const userId = principalIdFromAuth(
      (
        ctx as {
          session?: {
            auth?: {
              current?: { principalId?: string };
              initiator?: { principalId?: string };
            };
          };
        }
      ).session?.auth,
    );

    let reservationId: string | null = null;
    if (userId) {
      const gate = await assertCanSpend({
        userId,
        cents: WEB_SEARCH_FALLBACK_CENTS,
        reason: "search_x",
      });
      if (!gate.ok) {
        return { ok: false as const, error: blockMessage(gate.reason) };
      }
      reservationId = gate.reservationId;
    }

    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          type: "auto",
          numResults,
          includeDomains: [...X_DOMAINS],
          contents: { text: { maxCharacters: 500 } },
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          ok: false as const,
          error: `Exa search failed (${response.status}): ${body.slice(0, 240)}`,
        };
      }

      const data = (await response.json()) as ExaSearchResponse;
      const results = (data.results ?? []).map((hit) => ({
        title: hit.title ?? null,
        url: hit.url ?? null,
        publishedDate: hit.publishedDate ?? null,
        author: hit.author ?? null,
        snippet: hit.text?.slice(0, 400) ?? null,
      }));

      if (userId) {
        const micros = exaSearchMicros({ type: "auto", numResults });
        try {
          await recordUsage({
            idempotencyKey: `search_x:${data.requestId ?? randomUUID()}`,
            userId,
            source: "web_search",
            costMicros: micros,
            reservationId,
            metadata: {
              provider: "exa_search",
              tool: "search_x",
              numResults: results.length,
              domains: X_DOMAINS,
            },
          });
        } catch (error) {
          console.error("[search_x] billing", error);
        }
      }

      return {
        ok: true as const,
        note:
          "Public X/Twitter-indexed results only — not the user's personal timeline.",
        query,
        results,
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "search_x request failed",
      };
    }
  },
});

export default tool;
