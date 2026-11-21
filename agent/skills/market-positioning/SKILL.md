---
description: Use when the user needs to choose who to sell to and how to position against alternatives — ICP, segments, competitors, messaging angle — after a segment is in play. Triggers on "who should I target", "ICP", "positioning", "competitors", "market". If they are still discovering who has a problem (capability-first, niche, interviews, size before committing), load market-discovery first.
---

# Market and positioning

Start from a confirmed offer when writing a positioning doc. If there is no
offer brief, load `offer-discovery` first. If the user is still discovering
who has a problem worth solving (no chosen segment, niche exploration,
interviews, market size before committing), load `market-discovery` first
instead of drafting a settled ICP.

## ICP

Draft the ICP from what the user told you and what they sell, and mark every
inferred field as a hypothesis. Do not state an ICP as settled until the user
confirms it. Cover:

- Segment and company size, geography, and stage.
- The buyer role and the trigger event that creates urgency.
- Disqualifiers — who should not be contacted.
- Two or three sub-segments to test first.

Offer two or three candidate segments when the choice is open, with the
reasoning for each, and ask which to pursue. Prefer specific role + company
type language (not "SMBs").

## Market lists and research

- Prospect or company lists from a confirmed ICP → load `sales-prospecting` /
  `lead-generation` (`exa_agent_run`, `leads` preset). Confirm the ICP and list
  size before running.
- One named company or competitor in depth → load `company-research`.
- Market size, pricing landscape, or competitive landscape for a **candidate**
  segment → load `market-discovery` (or follow its citation rules below).
- A single quick fact → `web_search`.

### Citation rules for size, pricing, and competition

Every numeric figure and every named competitor must come from a tool result
this turn, with an inline citation, or be labeled as a rough estimate /
unknown. Do not invent TAM/SAM. Market pricing (what buyers pay today) is
distinct from the user's price — never invent theirs as settled. Status quo /
DIY counts as an alternative. Do not claim uniqueness without evidence. Do not
lock an ICP from size alone.

Cite sources inline. Do not fabricate companies, contacts, or market sizes.

## Positioning

Write a short positioning doc to a workspace file:

- **For / who** — the segment and the problem in their words.
- **Alternatives** — what they use today, and where each falls short, grounded
  in research you cited.
- **Difference** — what the offer does that alternatives do not, only where the
  user's proof supports it.
- **Messaging angles** — two or three, each tied to a trigger or pain.
- **Objections** — likely ones and honest responses.

Hand off to `pricing-and-terms` or `outreach-and-messaging` when the positioning
is confirmed.
