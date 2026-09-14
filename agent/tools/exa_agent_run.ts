import { defineTool } from "eve/tools";
import { z } from "zod";

// Deep research and lead-list generation via the Exa Agent API
// (https://api.exa.ai/agent/runs). Exa runs the multi-step search,
// verification, and enrichment internally; this tool starts a run and polls
// it until a terminal status, returning the structured result.
//
// Requires EXA_API_KEY in the environment.
//
// Note: keep inputSchema a plain ZodObject - eve introspects `.shape` when
// building the model-facing tool parameters, so avoid z.preprocess/.refine
// wrappers. Models also commonly send explicit nulls for optional fields,
// hence .nullish() plus null-coercion inside execute.

const AGENT_RUNS_URL = "https://api.exa.ai/agent/runs";
const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 240_000;

// Default structured-output schema covering both primary use cases (lead
// lists via `companies`, deep dives via overview/funding/competitors/people).
// Everything is optional so Exa fills what the task actually produces; the
// model under test cannot be relied on to emit nested output schemas itself.
const DEFAULT_RESEARCH_SCHEMA = (maxItems: number) => ({
  type: "object",
  properties: {
    overview: {
      type: "string",
      description: "2-3 sentence overview of the researched subject",
    },
    companies: {
      type: "array",
      maxItems,
      items: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          website: { type: "string", format: "uri" },
          product_description: {
            type: "string",
            description: "in 12 words or less",
          },
          icp_fit_score: {
            type: "integer",
            description: "1-10, when scoring against an ICP",
          },
          icp_fit_reasoning: {
            type: "string",
            description: "one-liner in 20 words or less",
          },
        },
        required: ["company_name", "website"],
      },
    },
    funding: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          round: { type: "string" },
          amount: { type: "string" },
          date: { type: "string" },
        },
      },
    },
    competitors: {
      type: "array",
      maxItems: 10,
      items: { type: "string" },
    },
    key_people: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: "string" },
        },
      },
    },
  },
});

const inputSchema = z.object({
  query: z
    .string()
    .describe(
      "Natural-language research task: the company to research, or the lead list to build (ICP, geography, stage, count). Always include this, even when polling an in-progress run with runId.",
    ),
  runId: z
    .string()
    .describe(
      "Run id from a previous call. Pass this (instead of query) to check progress or fetch the finished result.",
    )
    .nullish(),
  outputSchema: z
    .record(z.string(), z.unknown())
    .describe(
      "JSON schema for the structured result. Bound arrays with maxItems. For lead lists always include company_name, website, product_description, icp_fit_score, icp_fit_reasoning.",
    )
    .nullish(),
  systemPrompt: z
    .string()
    .describe(
      "Optional scoring rules, source preferences, dedup and exclusion emphasis.",
    )
    .nullish(),
  exclusions: z
    .array(z.record(z.string(), z.unknown()))
    .describe(
      "Companies to avoid: competitors, existing customers, or results from earlier runs.",
    )
    .nullish(),
  listItemFields: z
    .array(
      z.object({
        name: z.string(),
        type: z
          .enum(["string", "number", "integer", "boolean"])
          .nullish()
          .describe("Defaults to string."),
        description: z.string().nullish(),
      }),
    )
    .describe(
      "Recommended for list building: flat per-item fields (name, type, description). The tool builds the JSON schema internally, which is more reliable than hand-writing outputSchema.",
    )
    .nullish(),
  maxItems: z
    .number()
    .int()
    .positive()
    .describe("Maximum number of items in the built list. Defaults to 10.")
    .nullish(),
  effort: z
    .enum(["minimal", "low", "medium", "auto", "high", "xhigh", "max"])
    .describe(
      "Research depth. low by default; medium/auto for standard research; high/xhigh/max for large or hard lists.",
    )
    .nullish(),
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

async function startAgentRun(
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

async function getAgentRun(
  runId: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${AGENT_RUNS_URL}/${encodeURIComponent(runId)}`,
    {
      headers: { authorization: `Bearer ${apiKey}` },
      method: "GET",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Exa Agent API error (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

function toAgentRunResult(result: Record<string, unknown>): AgentRunResult {
  const output = result.output as
    | { text?: string; structured?: unknown; grounding?: unknown }
    | undefined;

  return {
    status: typeof result.status === "string" ? result.status : "unknown",
    runId: typeof result.id === "string" ? result.id : undefined,
    output: output
      ? {
          structured: output.structured,
          text: output.text,
          grounding: output.grounding,
        }
      : undefined,
    costDollars:
      typeof result.costDollars === "number" ? result.costDollars : undefined,
    error:
      result.error !== undefined && typeof result.error !== "object"
        ? String(result.error)
        : undefined,
  };
}

export default defineTool({
  description:
    "Deep company research and lead-list generation backed by the Exa Agent API. Exa decomposes the query, searches, verifies, enriches, and returns structured output with citations. Use for company deep dives, competitor analysis, ICP-based lead lists, and market research. For quick single lookups prefer web_search instead.",
  inputSchema,
  async execute(input) {
    // Coerce nulls to undefined, then guard.
    const query = input.query ?? undefined;
    const runId = input.runId ?? undefined;

    if (!query) {
      return {
        status: "error",
        error:
          "query is required. Describe the research task or lead list to build.",
      } satisfies AgentRunResult;
    }

    const apiKey = process.env.EXA_API_KEY?.trim();

    if (!apiKey) {
      return {
        status: "error",
        error:
          "EXA_API_KEY is not configured. Add it to the environment (https://dashboard.exa.ai/api-keys) and retry.",
      } satisfies AgentRunResult;
    }

    const startedAt = Date.now();

    // Polling an in-progress run when a runId is present; otherwise start.
    if (runId) {
      for (;;) {
        const result = await getAgentRun(runId, apiKey);
        const summary = toAgentRunResult(result);
        const status = summary.status;

        if (
          status === "completed" ||
          status === "failed" ||
          status === "cancelled"
        ) {
          return summary;
        }

        if (Date.now() - startedAt >= MAX_WAIT_MS) {
          return {
            ...summary,
            status: status || "running",
            note: "The run is still in progress. Call this tool again with the same runId to fetch the result.",
          };
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    // Starting a new run. Non-streaming runs hold their result for ~10
    // minutes of polling, so start, then poll by id.
    //
    // GLM-class models frequently drop optional/nested tool params, so
    // structured output is the DEFAULT: a combined research schema covering
    // both lead lists (companies) and deep dives (overview, funding,
    // competitors, people). Explicit outputSchema/listItemFields win when
    // provided.
    let outputSchema = input.outputSchema;

    if (!outputSchema && input.listItemFields?.length) {
      const maxItems = input.maxItems ?? 10;
      const properties = Object.fromEntries(
        input.listItemFields.map((field) => [
          field.name,
          {
            type: field.type ?? "string",
            ...(field.description ? { description: field.description } : {}),
          },
        ]),
      );

      outputSchema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            maxItems,
            items: {
              type: "object",
              properties,
              required: input.listItemFields.map((field) => field.name),
            },
          },
        },
        required: ["items"],
      };
    } else if (!outputSchema) {
      outputSchema = DEFAULT_RESEARCH_SCHEMA(input.maxItems ?? 10);
    }

    const created = await startAgentRun(
      {
        query,
        ...(input.effort ? { effort: input.effort } : {}),
        ...(outputSchema ? { outputSchema } : {}),
        ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
        ...(input.exclusions?.length
          ? { input: { exclusion: input.exclusions } }
          : {}),
      },
      apiKey,
    );

    const createdRunId =
      typeof created.id === "string" ? created.id : undefined;

    if (!createdRunId) {
      return {
        status: "error",
        error: "The Exa Agent API did not return a run id.",
      } satisfies AgentRunResult;
    }

    const createdStatus =
      typeof created.status === "string" ? created.status : "queued";

    if (
      createdStatus === "completed" ||
      createdStatus === "failed" ||
      createdStatus === "cancelled"
    ) {
      return toAgentRunResult(created);
    }

    for (;;) {
      const result = await getAgentRun(createdRunId, apiKey);
      const summary = toAgentRunResult(result);
      const status = summary.status;

      if (
        status === "completed" ||
        status === "failed" ||
        status === "cancelled"
      ) {
        return summary;
      }

      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        return {
          ...summary,
          status: status || "running",
          runId: summary.runId ?? createdRunId,
          note: "The run is still in progress. Call this tool again with the same runId to fetch the result.",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  },
});
