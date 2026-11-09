---
description: Use when the user needs to choose who to sell to and how to position against alternatives — ICP, segments, competitors, messaging angle. Triggers on "who should I target", "ICP", "positioning", "competitors", "market".
---

# Market and positioning

Start from a confirmed offer. If there is no offer brief, load
`offer-discovery` first.

## ICP

Draft the ICP from what the user told you and what they sell, and mark every
inferred field as a hypothesis. Do not state an ICP as settled until the user
confirms it. Cover:

- Segment and company size, geography, and stage.
- The buyer role and the trigger event that creates urgency.
- Disqualifiers — who should not be contacted.
- Two or three sub-segments to test first.

Offer two or three candidate segments when the choice is open, with the
reasoning for each, and ask which to pursue.

## Market lists and research

- Prospect or company lists from a confirmed ICP → load `lead-generation`
  (`exa_agent_run`, `leads` preset). Confirm the ICP and list size before
  running.
- One named company or competitor in depth → load `company-research`.
- A single quick fact → `web_search`.

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
