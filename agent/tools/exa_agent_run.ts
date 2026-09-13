import { defineTool } from "eve/tools";
import { z } from "zod";

// Deep research and lead-list generation via the Exa Agent API
// (https://api.exa.ai/agent/runs). Exa runs the multi-step search,
// verification, and enrichment internally; this tool starts a run or polls an
// existing one and returns the structured result.
//
// Requires EXA_API_KEY in the environment.

const AGENT_RUNS_URL = "https://api.exa.ai/agent/runs";
const POLL_INTERVAL_MS = 4_000;
const MAX_WAIT_MS = 240_000;

const inputSchema = z
  .object({
    query: z
      .string()
      .describe(
        "Natural-language research task: the company to research, or the lead list to build (ICP, geography, stage, count).",
      )
      .optional(),
    runId: z
      .string()
      .describe(
        "Run id from a previous call. Pass this (instead of query) to check progress or fetch the finished result.",
      )
      .optional(),
    outputSchema: z
      .record(z.string(), z.unknown())
      .describe(
        "JSON schema for the structured result. Bound arrays with maxItems. For lead lists always include company_name, website, product_description, icp_fit_score, icp_fit_reasoning.",
      )
      .optional(),
    systemPrompt: z
      .string()
      .describe(
        "Optional scoring rules, source preferences, dedup and exclusion emphasis.",
      )
      .optional(),
    exclusions: z
      .array(z.record(z.string(), z.unknown()))
      .describe(
        "Companies to avoid: competitors, existing customers, or results from earlier runs.",
      )
      .optional(),
    effort: z
      .enum(["low", "auto", "high", "xhigh"])
      .describe("low by default; higher effort for large or hard lists.")
      .optional(),
  })
  .refine((input) => Boolean(input.query || input.runId), {
    message: "Provide either query (start a run) or runId (poll a run).",
  });

type AgentRunResult = {
  status: string;
  runId?: string;
  output?: {
    text?: string;
    structured?: unknown;
    grounding?: unknown;
  };
  costDollars?: number;
  note?: string;
  error?: string;
};

async function callAgentRun(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(AGENT_RUNS_URL, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Exa Agent API error (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

export default defineTool({
  description:
    "Deep company research and lead-list generation backed by the Exa Agent API. Exa decomposes the query, searches, verifies, enriches, and returns structured output with citations. Use for company deep dives, competitor analysis, ICP-based lead lists, and market research. For quick single lookups prefer web_search instead.",
  inputSchema,
  async execute(input) {
    const apiKey = process.env.EXA_API_KEY?.trim();

    if (!apiKey) {
      return {
        status: "error",
        error:
          "EXA_API_KEY is not configured. Add it to the environment (https://dashboard.exa.ai/api-keys) and retry.",
      } satisfies AgentRunResult;
    }

    const startedAt = Date.now();
    let lastBody: Record<string, unknown>;

    if (input.runId) {
      lastBody = { runId: input.runId };
    } else {
      lastBody = {
        query: input.query,
        ...(input.effort ? { effort: input.effort } : {}),
        ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
        ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
        ...(input.exclusions?.length
          ? { input: { exclusion: input.exclusions } }
          : {}),
      };
    }

    let runId = input.runId;

    for (;;) {
      const result = await callAgentRun(lastBody, apiKey);
      runId = typeof result.id === "string" ? result.id : runId;
      const status = typeof result.status === "string" ? result.status : "";

      if (status === "complete") {
        const output = result.output as
          | { text?: string; structured?: unknown; grounding?: unknown }
          | undefined;

        return {
          status,
          runId,
          output: output
            ? {
                structured: output.structured,
                text: output.text,
                grounding: output.grounding,
              }
            : undefined,
          costDollars:
            typeof result.costDollars === "number"
              ? result.costDollars
              : undefined,
        } satisfies AgentRunResult;
      }

      if (status === "failed" || status === "cancelled") {
        return {
          status,
          runId,
          error:
            typeof result.error === "string"
              ? result.error
              : "The Exa run ended unsuccessfully.",
        } satisfies AgentRunResult;
      }

      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        return {
          status: status || "running",
          runId,
          note: "The run is still in progress. Call this tool again with the same runId to fetch the result.",
        } satisfies AgentRunResult;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  },
});
