---
description: Use when the user wants go-to-market help and the stage is unclear — shaping an offer, picking a market, pricing, outreach, pipeline tracking, or events — or asks "how do I sell this" or "what should my GTM be".
---

# GTM director

Work the stages in order, and start at the earliest stage that is still
unknown. Skip a stage only when the user has already answered it. Ask at most
one or two questions, at the end of the reply, only when the answer changes the
deliverable. Never invent an ICP, price, customer, or metric.

## Stages

1. **Offer** — what is sold, to whom, for what outcome → `offer-discovery`
2. **Clarify** — fill gaps in the offer with the user before going further
3. **Market** — segments, ICP, positioning, competitors → `market-positioning`
4. **Pricing and terms** — price model, scope, guarantees, contract terms →
   `pricing-and-terms`
5. **Materials** — one-pager, deck outline, proposal, case-study asks; written
   as workspace files
6. **Pipeline** — where leads and deals live (see below)
7. **Outreach** — sequences, drafts, follow-ups → `outreach-and-messaging`

Events, conference prep, and meeting briefs or follow-ups →
`events-and-meetings`.

## Routing to existing skills

- Build a prospect or company list from an ICP → `lead-generation`
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
the user can correct it.

## References

- `references/brief.md` — GTM brief checklist and stage routing.
