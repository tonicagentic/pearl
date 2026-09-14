---
description: Use when generating leads, building prospect lists, finding companies to sell to, doing outbound research, or ICP-based company discovery. Triggers on "leads", "lead gen", "prospect list", "find companies", "ICP", "outbound list".
---

# Lead Generation with the Exa Agent

Generate enriched lead lists with the Exa Agent API via `exa_agent_run`. An
Agent run is an asynchronous, multi-step web research task: you describe the
list you want plus the per-company fields, and Exa handles query decomposition,
searching, verification, enrichment, and structured output internally. You do
NOT need to orchestrate parallel searches, subagents, or manual deduplication.

## Tool Restriction

Use `exa_agent_run` for the lead list itself. Do NOT use generic `web_search`
for building the list.

## Workflow

```
1. Confirm the ICP with the user (one small low-effort run if research is needed)
2. Call exa_agent_run with preset "leads" and maxItems
3. If the run is still in progress, call exa_agent_run again with the same runId
4. Read output.structured.companies from the result
5. Present the list (sorted by icp_fit_score descending)
6. Optional: expand with follow-up runs (previousRunId + exclusions)
```

## Step 1: Understand the ICP

When the user says something like "Make a list of 200 leads for [company]",
first establish the Ideal Customer Profile. If the user already described the
ICP, confirm it. If not, run one small low-effort run to research it:

```
exa_agent_run {
  "query": "Research {company_name}: what they sell, who their existing customers are, and what their ideal customer profile is.",
  "effort": "low",
  "listItemFields": [
    { "name": "company_description", "description": "What the company does in 2 sentences or less" },
    { "name": "icp_description", "description": "Concise ICP description that clearly defines target companies" },
    { "name": "sub_verticals", "description": "Sub-verticals breaking down the ICP" },
    { "name": "useful_enrichments", "description": "Enrichment columns useful for filtering high-signal companies" }
  ]
}
```

Present the ICP to the user and confirm:

- Is the ICP description accurate?
- Any companies to exclude (competitors, existing customers)?
- How many leads do they want? (default 200)
- Any specific enrichment columns they care about?

## Step 2: Create the Lead-Gen Run

Use the `leads` preset — it applies the standard scored fields and the tool
builds the JSON schema internally. Set `maxItems` to the list size and `effort`
for depth (`low` by default; higher for large or hard lists).

**Fields the preset returns per company:**

- `company_name`
- `website`
- `product_description` ("in 12 words or less")
- `icp_fit_score` (integer, 1-10)
- `icp_fit_reasoning` ("compelling one-liner in 20 words or less")

Example:

```
exa_agent_run {
  "query": "Find 100 companies matching this ICP: {icp_description}. Prioritize {sub_verticals}. For each company, score ICP fit 1-10 for {user_company}.",
  "preset": "leads",
  "maxItems": 100,
  "effort": "low",
  "systemPrompt": "Prefer official company sites and recent funding announcements. Do not include duplicates or subsidiaries of the same parent company.",
  "exclusions": [
    { "company_name": "{competitor_1}" },
    { "company_name": "{existing_customer_1}" }
  ]
}
```

The scored list arrives in `output.structured.companies`.

For advanced cases needing custom or nested structures, `listItemFields`
(flat per-item fields) and `outputSchema` (a JSON schema) are supported as
escape hatches.

## Step 3: Read Output

Read `output.structured.items` from the result. Do not paste full raw output
into the conversation — summarize the list for the user.

## Step 4: Expanding the List

If the user wants more leads than one run returned:

- Ask for a follow-up run with the previous run's results as `exclusions` so
  the new run avoids them
- Re-deduplicate by normalized company name (strip "Inc"/"Ltd"/etc.,
  case-insensitive)

For lists in the many hundreds, run a few runs sequentially this way rather
than one giant run, and confirm scope with the user first: "This will require
~{N} Agent runs. Proceed?"

## Handling Failures

- If a run ends `failed`, read the error from the result, adjust the query or
  fields, and retry once with different wording
- If results are consistently below the requested count, narrow the ICP into
  2-3 sub-vertical runs instead of one broad run
