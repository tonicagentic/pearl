---
description: Use when generating leads or building a company prospect list from a stated industry or ICP — "leads", "lead gen", "lead list", "find companies", "outbound list", "build a lead list of N". Prefer this over sales-prospecting when the user already named the sector and asked for a scored company list with fields. If they are still defining the offer or ICP (sales prospecting, who to sell to, blanks everywhere), load sales-prospecting first.
---

# Lead Generation with the Exa Agent

Generate enriched lead lists with the Exa Agent API via `exa_agent_run`. An
Agent run is an asynchronous, multi-step web research task: you describe the
list you want plus the per-company fields, and Exa handles query decomposition,
searching, verification, enrichment, and structured output internally. You do
NOT need to orchestrate parallel searches, subagents, or manual deduplication.

## Before you run

If the user is still choosing who to sell to (blank industry, "start sales
prospecting", "who could I sell to") with no sector given, load
`sales-prospecting` first. **Never** invent industry, size, role, or problem.

If they already named the industry/sector and asked for a lead list of N
companies with fields, **run `exa_agent_run` in this turn** even when Offer or
some ICP fields are blank — put "not specified" for missing fields in the
query rather than stopping to interview.

When the user wants a targeted list and says fit matters more than volume (or
gives no count), default `maxItems` to at most 15 — not 200. When they give an
explicit count (e.g. 5 or 10), use that count.

## Tool Restriction

Use `exa_agent_run` for the lead list itself. Do NOT use generic `web_search`,
`bash`, or a subagent for building the list or for shared-pain segment
research. When the user has confirmed the ICP and asked for a list, call
`exa_agent_run` as the first research tool in that turn.

## Workflow

```
1. Confirm the offer and ICP with the user (ask blanks — do not research them)
2. Call exa_agent_run with preset "leads" and maxItems
3. If the run is still in progress, call exa_agent_run again with the same runId
4. Read output.structured.companies from the result
5. Present the list (sorted by icp_fit_score descending)
6. Optional: expand with follow-up runs (previousRunId + exclusions)
```

## Step 1: Confirm the ICP

When the user says something like "Make a list of leads for [company]" or
"build a prospect list":

1. Restate the Offer and ICP records from what they already said.
2. If any field is blank, ask for every blank in one reply and wait. Do not call
   `exa_agent_run` yet.
3. If the Offer and ICP are already filled in this turn (or the prior turn just
   filled them) and the user asked to build a list, **call `exa_agent_run`
   immediately** — do not stop to re-confirm list size or exclusions. Default
   `maxItems` to ≤ 15 when they said fit over volume or gave no count. Only ask
   about exclusions or a larger count when those answers are still missing and
   would change the run.

Do **not** run a low-effort Exa job to invent an ICP for them.

## Step 2: Create the Lead-Gen Run

Use the `leads` preset — it applies the standard scored fields and the tool
builds the JSON schema internally. Set `maxItems` to the list size and `effort`
for depth (`low` by default; higher for large or hard lists). Put the offer
name and the four ICP phrases in `query` so the run is driven by what the user
confirmed.

For prospecting lists that need a reason to reach out, also pass
`listItemFields` that include a trigger field named `outreach_trigger`,
`trigger`, or `reason_to_reach_out`.

**Fields the preset returns per company:**

- `company_name`
- `website`
- `product_description` ("in 12 words or less")
- `icp_fit_score` (integer, 1-10)
- `icp_fit_reasoning` ("compelling one-liner in 20 words or less")

Example:

```
exa_agent_run {
  "query": "Find companies matching this ICP: industry {industry}, size {size}, buyer {role}, problem {problem}. Offer: {offer_name}. Prefer fit over volume.",
  "preset": "leads",
  "maxItems": 10,
  "effort": "low",
  "listItemFields": [
    { "name": "outreach_trigger", "description": "Public reason to reach out (new hire, expansion, post) or note none found" }
  ],
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

Read `output.structured.items` or `output.structured.companies` from the
result. Do not paste full raw output into the conversation — summarize the
list for the user. Do not invent emails, mutual connections, or customer
results. Mark unverified contact details as unverified.

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
