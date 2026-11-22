---
description: Use when the user is sales prospecting — defining an offer and ideal customer, prospecting broadly for ICP angles, "who should we sell this to", "what kinds of customers could we sell X to", "customer profiles" for a value prop, qualifying an ICP, finding other ICPs who share a pain, or building a short company list after the offer and ICP were just confirmed. Triggers on "sales prospecting", "kinds of customers", "customer profiles", "who could I sell to", "who should we sell this to", "sell custom AI agents", "personal agent", "prospect broadly", "ideal customer", "qualify this ICP", "who else has this pain", "targeted list" with a filled ICP. For a classic "build a lead list of N companies in industry X with these fields" request where the user already named the sector, prefer lead-generation.
---

# Sales prospecting

One offer can point at several ideal customers. A company list starts only after
the user has picked one customer and the offer is known. Never invent an offer,
ICP, customer, email, mutual connection, or metric the user did not give you.

**Classic lead-gen exception:** if the user already named an industry/sector and
asked for N companies with explicit fields (and is not asking to define an
offer or ICP), load `lead-generation` and run `exa_agent_run` — do not block
on a blank Offer record.

## Records (show every time they are in play)

```text
Offer
Name:         <user's words, or blank>
Kind:         specific product | general offer | blank
What it does: <user's words, or blank>
Pain:         <the problem it addresses, or blank>
```

```text
ICP
Industry:     <user's words, or blank>
Company size: <user's words, or blank>
Buyer role:   <user's words, or blank>
Problem:      <user's words, or blank>
```

Filled fields stay in the user's words. Blank fields are asked for in the
**same** reply — every blank at once (this overrides the usual GTM one-or-two
question cap). Do not invent values. Do not call `exa_agent_run` or
`web_search` until the records required for the current ask are filled.

Write Offer records, ICP records, Options, Angles, and the scorecard as
**plain markdown in the chat reply** (fenced `text` blocks are fine). Do not
put the only copy of those records inside a UI card / json-render spec — the
user must be able to read them in the message text.

When Kind, Name, or What it does is blank, ask whether this is a specific
product or a general offer, and what it is. You may write a confirmed offer to
a workspace file for reuse, but if the user also asked for a company list or
shared-pain segments in that turn, **`exa_agent_run` must run in the same turn**
— never end the turn on `write_file` alone.

## Paths

**Hard rule:** `exa_agent_run` is a first-party tool call (not a shell command,
not `bash`, not a subagent). When a path below says to research, invoke the
`exa_agent_run` tool with a `query` argument. Never claim the tool is missing
or unavailable — call it. If the call errors (for example a missing API key),
report that error; do not invent a list or substitute `web_search`.

**Research is forbidden** on Clarify, Angles, Identify customer profiles, and
Qualify. Never call `exa_agent_run`, `web_search`, `bash`, or a subagent on
those paths — even if the tool is available. Research is allowed only on
Shared pain (after the offer is filled) and Company list (after offer + ICP
are filled).

**Pick one path:**

| User signal | Path |
|---|---|
| Blanks remain, or "ask only for what is still blank" | **Clarify** |
| Offer filled; wants broad options / "kinds of customers" / "prospect broadly" without asking you to only solicit blanks, and without asking for scored profiles | **Angles** |
| "Who should we sell this to?" / "customer profiles" / named product + who to sell or market to / asks for scored options | **Identify customer profiles** |
| "Should this be the ICP?" / qualify | **Qualify** |
| Pain-only "who else has this pain?" | **Shared pain** |
| Offer + chosen ICP + build a list | **Company list** |

### Clarify (blanks remain)

Show both records with filled fields in the user's words and blanks left blank.
Ask every blank field in this reply. If the user said "ask only for what is
still blank," ask **only** the blank ICP fields (do not re-ask filled Offer
fields, and do **not** invent Option/Angle hypotheses). Stop. No research.
No company list.

### Angles (offer known; user wants broad customer options)

Use this only when the user wants to see kinds of customers / prospect broadly
— not when they asked you to solicit blank ICP fields.

Restate the Offer record first. Then propose two or three candidate ICPs that
share the offer's Pain. Differ by industry or buyer role. Use this shape for
each option:

```text
Option N (hypothesis)
ICP
Industry: …
Company size: …
Buyer role: …
Problem: … (tied to the offer's Pain)
Angle
Why this offer appeals to that buyer (one or two sentences).
```

Label them as options. End with an explicit question: which option should we
**build a prospect list for** (not merely "explore"). Keep every Option's
Problem tied to the offer's Pain wording. Prefer end-customer segments over
channel/partner hypotheses unless the user asked for partners. Do not invent
won customers. Do not start a company list. Do not research — inventing
options from the offer's Pain is enough; do not call tools.

### Identify customer profiles ("who should we sell this to")

Use when the user wants a few **scored** customer profiles from a value prop
or named product — not merely unranked angles, and not a company list.

**If they only named a product** (e.g. custom AI agents) and What it does /
Pain are still blank: show the Offer record with Name set to their product
words and Kind `specific product`. Leave What it does and Pain blank or
"unknown" and **ask for both**. Stop there — do **not** invent a settled
product description, and do **not** dump finished scored profiles yet. Wait
until the user fills the offer so profiles are grounded in what they sell.

**Once the offer is filled** (value prop given, or just answered): restate the
Offer record, then propose two or three distinct profiles in the
Option/ICP/Angle shape above. Prefer concrete role + company context over
vague "enterprises." For **every** option, score pain, fit, budget,
reachability, and economics with each line labeled `Hypothesis:` (or Fact /
Unknown) so the user can compare. Prefer recommending one focus in the same
reply, then invite them to override. Do not invent a price, retention rate,
or existing customer. Do not start a company list. Do not research.

### Qualify (filled offer + ICP; user asks if this should be the ICP)

Restate both records unchanged. Score with one line each:

- **Pain** — how urgent and costly the problem is
- **Fit** — whether *this offer* can solve it well today
- **Budget** — whether these buyers can and will pay
- **Reachability** — whether the user can reliably reach that buyer
- **Economics** — retain, expand, profitable to support

Prefix every line with `Fact:`, `Hypothesis:`, or `Unknown:`. Fit must be
`Unknown:` or a question / cautious hypothesis — never a flat "yes" just
because a problem was named. Do not invent dollars, reply rates, retention
rates, or "they will pay." Do not research.

### Shared pain (user names a pain and asks who else has it)

If the offer is blank except Pain, ask for Kind / Name / What it does first —
do not research yet. After the offer is filled, **in that same turn** the first
tool call must be `exa_agent_run` yourself. Do **not** use `web_search`,
`bash`, a subagent, or the `agent` tool for this research:

```
exa_agent_run {
  "query": "Find ideal-customer segments that share this pain: {pain}. Offer: {name} — {what it does}. Return distinct industries and buyer roles. Include unplanned compressor downtime phrasing when that is the pain.",
  "effort": "low",
  "maxItems": 10,
  "listItemFields": [
    { "name": "industry", "description": "Industry or niche" },
    { "name": "buyer_role", "description": "Buyer role title" },
    { "name": "company_size", "description": "Typical company size if known" },
    { "name": "problem", "description": "How the shared pain shows up for them" },
    { "name": "angle", "description": "Why the offer would appeal, one or two sentences" },
    { "name": "source", "description": "URL or named source supporting this segment" }
  ]
}
```

Do **not** use `preset: "leads"`. Cap `maxItems` at 15. Put the user's exact
pain phrase in `query`. Return at least two ICP records with angles and
sources. Do not present a prospect list of named companies to email.

### Company list (offer + chosen ICP filled; user wants a list)

When the user has filled Offer + ICP and asks for a targeted company list,
the **first tool call in that turn must be `exa_agent_run`**. Do not use
`web_search`, `bash`, or a subagent instead. Do not stop after `write_file` —
`write_file` is optional and comes **after** starting the Exa run.

1. Call `exa_agent_run` immediately with the offer **name** and all four ICP
   phrases (**industry**, **company size**, **buyer role**, **problem**)
   appearing verbatim in `query`. Use `preset: "leads"` and pass
   `listItemFields` that include a field named `outreach_trigger`, `trigger`,
   or `reason_to_reach_out`. Cap `maxItems` at 15 when the user says fit
   matters more than volume (or gives no count). Example:

```
exa_agent_run {
  "query": "Find companies for offer maintenance monitoring. ICP: industrial refrigeration, 80 to 200 employees, VP of operations, unplanned compressor downtime. Fit over volume.",
  "preset": "leads",
  "maxItems": 10,
  "effort": "low",
  "listItemFields": [
    { "name": "outreach_trigger", "description": "Public reason to reach out or note none found" }
  ]
}
```

2. Optionally write the offer to a workspace file (after starting Exa).
3. Restate both records in plain markdown (filled fields in the user's words).
4. Present the short list. Prefer **end operators** in the ICP's industry
   (e.g. cold-storage / food plants that run compressors), not refrigeration
   contractors or OEMs, unless the ICP itself is a contractor. Every row must
   include a public trigger **or** the words "none found". Skip rows outside
   the stated company-size band when better fits exist.
5. Show the five-part scorecard. Prefix every line with `Fact:`,
   `Hypothesis:`, or `Unknown:` — never a bare "high" / "yes" / dollar figure
   without that label. No invented emails, mutual connections, or customer
   results. Mark unverified contacts as unverified.

## Hand-offs

- Capability-first market discovery (who has a problem worth solving, interviews,
  niche markets, size/competition before committing) → `market-discovery`
- Confirmed ICP company lists only → this skill, then keep using
  `lead-generation` mechanics via `exa_agent_run` as above
- Cold email drafts → `outreach-and-messaging`
- Pricing the user's offer → `pricing-and-terms`
