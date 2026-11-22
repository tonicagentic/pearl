---
description: Use when the user wants go-to-market help and the stage is unclear — shaping an offer, picking a market, pricing, outreach, pipeline tracking, or events — or asks "how do I sell this" or "what should my GTM be".
---

# GTM director

Work the stages in order, and start at the earliest stage that is still
unknown. Skip a stage only when the user has already answered it. Never invent
an ICP, price, customer, or metric.

Ask clarifying questions at the end of the reply only when the answer changes
the deliverable. For most stages, ask at most one or two. **Exception:** when
filling Offer or ICP records for `sales-prospecting` or `market-discovery`, ask
every blank field in that same reply.

## Stages

1. **Offer** — what is sold, to whom, for what outcome → `offer-discovery`
2. **Clarify** — fill gaps in the offer with the user before going further
3. **Discover** — who has a problem worth solving (candidates, interviews,
   size/competition before committing) → `market-discovery`
4. **Prospect** — offer + ICP records, angles, qualify, short lists →
   `sales-prospecting`
5. **Market / position** — confirmed segment positioning → `market-positioning`
6. **Pricing and terms** — price model, scope, guarantees, contract terms →
   `pricing-and-terms`
7. **Materials** — one-pager, deck outline, proposal, case-study asks; written
   as workspace files
8. **Pipeline** — where leads and deals live (see below)
9. **Outreach** — sequences, drafts, follow-ups → `outreach-and-messaging`

Events, conference prep, and meeting briefs or follow-ups →
`events-and-meetings`.

## Routing to existing skills

- Build a prospect or company list from a **confirmed** offer and ICP →
  `sales-prospecting` (then `lead-generation` mechanics)
- Still defining who to sell to, customer profiles / "kinds of customers" for
  a value prop or named product, qualify an ICP, shared-pain ICPs, prospect
  broadly → `sales-prospecting`
- Capability-first discovery ("I know how to build X"), niche markets,
  interviews, market size / competition before committing → `market-discovery`
- Deep dive on one named company or competitor → `company-research`
- Voice for written copy → the user's house style skills when they apply

## Pipeline home

- Company pipeline (accounts, people, deals, meetings, proposals): the Tempo
  connection. Use the tools the connection exposes; do not name or assume them.
- Project-only tracker: a Google Sheet via the Sheets connection, with a CSV
  fallback written by `write_file` when Sheets is not connected.

State which home you chose and why. Do not duplicate rows in both.

## Output

The deliverable is a file in the workspace, not a long chat reply. Chat gets a
one-line note and a `file://` link. Label every assumption you had to make so
the user can correct it. Prospecting and discovery replies that show Offer/ICP
records and ask blanks may stay in chat until the user confirms.

## References

- `references/brief.md` — GTM brief checklist and stage routing.
