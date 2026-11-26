---
description: Use for deep company research with the Exa Agent API — funding, competitors, tech stack, news, key people — plus quick company lookups with web_search. Use when researching companies, doing competitor analysis, market research, or researching a single company in depth.
---

# Company Research

## Tool Selection (Critical)

Two Exa-backed surfaces, two jobs:

- **`exa_agent_run`** — the default for company research. Use it for deep dives,
  competitor analysis, and multi-angle research (product + funding + news +
  people). One run handles query decomposition, multi-step searching, and
  synthesis internally — do not orchestrate many manual `web_search` calls for
  work one run covers.
- **`web_search`** — quick, low-latency lookups: a single news check, a fast
  fact, or finding a homepage.

## Deep Dives: Exa Agent

`exa_agent_run` blocks until the run finishes. If it returns a run still in
progress, call it again with the same `runId` (plus the original `query`) to
fetch the result.

1. Call `exa_agent_run` with a natural-language `query` and, when you want
   repeatable structure, an `outputSchema` (bound arrays with `maxItems`).
2. Read `output.structured`, `output.text`, and `output.grounding` citations
   from the result.

Useful inputs: `systemPrompt` (source preferences, dedup rules),
`exclusions` (companies to avoid), `effort` (`"low"` default; `"auto"`,
`"high"`, or `"xhigh"` for more depth).

### Example: company deep dive

```
exa_agent_run {
  "query": "Research Anthropic: product lines, funding history and valuation, key executives, main competitors, and notable news from the last 6 months.",
  "effort": "auto",
  "outputSchema": {
    "type": "object",
    "properties": {
      "overview": { "type": "string" },
      "funding": { "type": "array", "maxItems": 10, "items": { "type": "object", "properties": { "round": { "type": "string" }, "amount": { "type": "string" }, "date": { "type": "string" } }, "required": ["round"] } },
      "competitors": { "type": "array", "maxItems": 10, "items": { "type": "string" } },
      "key_people": { "type": "array", "maxItems": 10, "items": { "type": "object", "properties": { "name": { "type": "string" }, "title": { "type": "string" } }, "required": ["name", "title"] } }
    },
    "required": ["overview", "competitors"]
  }
}
```

## Quick Lookups: web_search

Use `web_search` when a single fast search answers the question. Keep queries
specific. For current facts, prefer recent sources and cite them.

## Output Format

Return:

1. Results (structured list; one company per row)
2. Sources (URLs; 1-line relevance each — use `output.grounding` from Agent
   runs)
3. Notes (uncertainty/conflicts)
