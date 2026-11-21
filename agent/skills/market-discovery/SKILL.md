---
description: Use when the user is discovering who has a problem worth solving before committing to a segment — capability-first ("I know how to build X, who could I sell to"), niche markets that interest them, validating segments with interviews, reading interview notes, testing a small pilot, choosing a starting ICP, or researching market size, pricing landscape, or competition for candidate segments. Triggers on "I know how to build", "niche markets", "validate this segment", "interview customers", "market size", "competitive landscape", "starting ICP". For "kinds of customers could we sell [named product] to" prefer sales-prospecting.
---

# Market discovery

Find who has a problem worth solving **before** locking an ICP. Distinct from
`sales-prospecting` (company lists after an ICP is chosen) and from
`market-positioning` (positioning doc once a segment is confirmed).

Never invent customers, interview quotes, TAM/SAM figures, competitor names,
the user's price, or uniqueness claims without evidence from this turn.

## Candidate segments

When the user has a capability ("I know how to build X") or asks for niche
markets:

1. Show a light Offer record in the reply — Name from their words (e.g.
   "AI agents"), Kind `specific product` or blank, **What it does: blank /
   unknown**, **Pain: blank / unknown**.
2. Ask for those blanks in the same reply (what it does + which pain). On
   niche / "interest me and be profitable" asks, also ask what would interest
   them and what "profitable" means — in this same message (interest question
   can be at the top or bottom; it must appear).
3. In that **same** reply, still propose **two or three specific** candidate
   segments as hypotheses (buyer role + company type, e.g. "operations leads
   at small logistics companies" — **not** "SMBs" or "enterprises"). Do not
   wait for the interest answer before offering options.
4. Label them as hypotheses / options. Do not settle an ICP. Do not jump to a
   company prospect list. Do not invent profitability numbers.

## Interview design

To validate segments: plan **5–10 conversations per segment**. Script past
behavior only — do not pitch:

- "Tell me about the last time you dealt with this."
- "How do you handle it today?"
- "What does that cost in time or money?"
- "Who decides whether to buy a solution?"

Goal is learning, not closing. You may suggest where to find people at a high
level (events, communities, warm intros). Do not fabricate named contacts or
emails.

## Patterns from notes

When the user pastes interview notes, compare segments **only** on what is in
the notes. Structure the reply as a short comparison across:

- frequency of pain
- costly workarounds (use their numbers/words only)
- urgency
- budget / buying signals

Name the stronger segment(s) using the user's labels. Prefer the segment with
frequent costly pain and real commitment signals (paid pilot, time offered)
over "sounds useful" alone. Do not invent quotes, dollar figures, costs, or
extra story details that are not in the notes. Do not treat verbal interest
alone as demand. No research unless they ask.

## Pilot test

Propose a small **paid** pilot or manual service. Ask for a commitment of
money, time, or access — stronger than verbal interest. If the user has not
set a price, use placeholders or labeled options. Do not invent case studies.

## Choose starting ICP

Prioritize **demonstrated demand** and **ease of reaching buyers**, not the
largest-sounding market. Keep the choice a proposal until the user confirms.
Restate Industry, Company size, Buyer role, and Problem for confirmation.

## Landscape research (size, pricing, competition)

When the user asks how large a candidate market is, what pricing looks like
there, or what the competitive landscape is:

1. Research with `exa_agent_run` and/or `web_search`. Prefer `exa_agent_run`
   when comparing several players or sizing a niche. Call the tool yourself —
   do not claim it is unavailable.
2. Every figure or named competitor must use an **inline markdown citation**
   with a real URL from **this run** — e.g. `…$69/mo [1](https://example.com/pricing)`.
   Bare `[1]` footnotes without URLs do not count. If you lack a URL, write
   `Unknown` / rough estimate instead of inventing a domain or competitor.
3. Do not invent a precise TAM/SAM. Do not invent competitor names or list
   prices. Prefer fewer well-cited players over a long fabricated list.
4. **Pricing landscape** = what buyers pay today for tools, services, agencies,
   or status quo. Keep that separate from the user's own price. Never state the
   user's price as settled. If you float packaging ideas for them, every line
   must be labeled `Option:` or `Hypothesis:` — never "you should charge X."
5. **Competition** — short chat reply only (about one screen). Use this shape:

```text
### DIY / status quo
- Phone, email, spreadsheets / whiteboards — <one cited source describing that baseline>

### Incumbent tools
- <2–3 established products with inline URL citations>

### Agencies / managed services
- <1–2 named firms with citations, or "Unknown — no priced public example found">

Hypothesis: <one sentence, no uniqueness claim>
```

**Fail the path if you break these:** DIY + ≤3 household TMS names (McLeod,
Trimble, DAT, Truckstop, Rose Rocket, AscendTMS). One agency line about
percent-of-gross outsourced dispatch. No AI startups, no "early entrants,"
no "context" asides naming obscure vendors, no case-study anecdotes, no
"wedge" / "gap is opening" / uniqueness language. Stop after Hypothesis.
6. Do not lock an ICP from market size alone. Do not switch into a company
   prospect list unless the user asks for one after choosing a segment.

## Hand-offs

- Confirmed offer + ICP + company list → `sales-prospecting` / `lead-generation`
- Confirmed segment positioning doc → `market-positioning`
- User's packaging and price → `pricing-and-terms`
