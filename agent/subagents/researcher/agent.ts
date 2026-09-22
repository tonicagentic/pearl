import { defineAgent } from "eve";

import { DEFAULT_MODEL } from "../../agent.ts";

/**
 * Fresh-context web-research subagent.
 *
 * @remarks
 * A declared subagent — its `subagents/researcher/` location is what marks it as one — that the
 * root agent delegates to when a draft needs facts the Notion source material doesn't cover: a
 * statistic, a competitor detail, a primary-source link, or a claim to verify. It runs in its own
 * child session with no shared history and, like every declared subagent, inherits none of the
 * root's skills, connections, or tools. It does, however, get the framework default harness —
 * which includes `web_search` (provider-native; Anthropic's search for this model) and
 * `web_fetch` — so a web researcher needs no tool wiring. It judges and gathers only from what
 * the root packs into `message` plus what it finds on the open web.
 *
 * That isolation is the point: a researcher that can't see the thread or invent from the draft's
 * momentum is forced to ground every claim in a real, fetched source. It reinforces the root's
 * no-fabrication rule rather than weakening it — the root weaves in only `findings` that come
 * back with citations, and surfaces `gaps` to the writer instead of papering over them.
 *
 * `description` is required for a subagent: the root reads it to decide when to delegate.
 * `outputSchema` makes the findings a structured, cited result the root can act on directly.
 *
 * @see The research methodology and output contract in this folder's `instructions.md`.
 */
export default defineAgent({
  description:
    "Research a topic on the open web for facts, statistics, primary sources, and links the " +
    "writer needs but Notion doesn't cover. Runs refined searches against reliable sources and " +
    "returns cited findings with confidence levels, plus the gaps it couldn't verify. The " +
    "caller passes the question and any known context in the message.",
  // Our OSS default (agent.ts DEFAULT_MODEL); see the reviewer note on model policy.
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
  outputSchema: {
    additionalProperties: false,
    properties: {
      findings: {
        description:
          "One entry per verified factual claim; every entry carries at least one real source.",
        items: {
          additionalProperties: false,
          properties: {
            claim: {
              description:
                "A single, specific factual claim the draft can rely on.",
              type: "string",
            },
            confidence: {
              description:
                "'high' = multiple strong independent sources; 'low' = single or weaker source.",
              enum: ["high", "medium", "low"],
              type: "string",
            },
            notes: {
              description:
                "Caveats: date-sensitivity, scope limits, or where sources disagree.",
              type: "string",
            },
            sources: {
              description:
                "The real, fetched sources backing the claim; never empty, never invented.",
              items: {
                additionalProperties: false,
                properties: {
                  title: {
                    description: "The source's title or publication name.",
                    type: "string",
                  },
                  url: {
                    description: "The source URL, as visited.",
                    type: "string",
                  },
                },
                required: ["url", "title"],
                type: "object",
              },
              minItems: 1,
              type: "array",
            },
          },
          required: ["claim", "sources", "confidence", "notes"],
          type: "object",
        },
        type: "array",
      },
      gaps: {
        description:
          "What could not be found or verified; surfaced to the writer rather than guessed at.",
        items: { type: "string" },
        type: "array",
      },
      summary: {
        description:
          "A 1-3 sentence synthesis of what the research establishes, for the root to scan first.",
        type: "string",
      },
    },
    required: ["summary", "findings", "gaps"],
    type: "object",
  },
});
