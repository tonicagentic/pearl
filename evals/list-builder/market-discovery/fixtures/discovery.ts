// Shared phrases and notes for the market-discovery suite.

export const CAPABILITY = {
  skill: "build AI agents",
  promptSellTo: "I know how to build AI agents, who could I sell to?",
  promptNiche:
    "What are some niche markets I could target that'd interest me and be profitable",
  promptDesignLiving:
    "I have a good design sense. How can I turn this into something that I do for a living?",
} as const;

/** Specific candidate segments — role + company type, not "SMBs". */
export const SEGMENTS = {
  logistics: {
    label: "operations leads at small logistics companies",
    industry: "regional freight and last-mile logistics",
    companySize: "20 to 80 employees",
    buyerRole: "operations lead",
    problem: "manual dispatch and exception handling eating the day",
  },
  clinics: {
    label: "office managers at multi-site dental clinics",
    industry: "multi-site dental clinics",
    companySize: "3 to 8 locations",
    buyerRole: "office manager",
    problem: "appointment no-shows and chart prep falling through cracks",
  },
  agencies: {
    label: "producers at boutique video agencies",
    industry: "boutique video production agencies",
    companySize: "8 to 25 employees",
    buyerRole: "producer",
    problem: "client status updates assembled by hand every week",
  },
} as const;

/** Mild / infrequent pain — weaker than logistics and clinics in the notes. */
export const WEAK_SEGMENT = SEGMENTS.agencies;

export const STRONG_SEGMENT = SEGMENTS.logistics;

export const SEGMENTS_PROMPT = [
  `Candidate segments (hypotheses, not settled ICPs):`,
  `1. ${SEGMENTS.logistics.label}`,
  `2. ${SEGMENTS.clinics.label}`,
  `3. ${SEGMENTS.agencies.label}`,
].join("\n");

/**
 * Fake interview notes. Logistics and clinics show frequent costly urgent pain;
 * agencies show mild infrequent pain and "sounds useful" without budget urgency.
 */
export const INTERVIEW_NOTES = `
Interview notes (5 people per segment). Quotes are from these conversations only.

## ${SEGMENTS.logistics.label}
- Last time: three said a late truck or missed pickup last week; they spent 2–4 hours on calls and spreadsheets.
- Today: WhatsApp group + spreadsheet; one person is the bottleneck.
- Cost: roughly $800–$2,000 per bad day in overtime and missed SLAs (their numbers).
- Who buys: ops lead proposes; owner signs if under ~$1k/mo.
- Urgency: "this happens every week"; two asked when they could try something.
- One said they would pay for a two-week manual pilot if it cut the fire drills.

## ${SEGMENTS.clinics.label}
- Last time: no-show cascade last Monday; front desk rebooked for 90 minutes.
- Today: phone reminders + sticky notes; chart prep is overnight scramble.
- Cost: "about one hygienist-hour a day lost" (their words); no dollar figure given.
- Who buys: office manager; dentist owner must approve anything over $200/mo.
- Urgency: frequent but they are skeptical of new software after a failed CRM.

## ${SEGMENTS.agencies.label}
- Last time: status deck for a client — took 45 minutes, once every two weeks.
- Today: Notion + email; "annoying but fine."
- Cost: no money figure; "not worth a big project."
- Who buys: producer; founder rarely involved.
- Interest: two said it "sounds useful" but none offered time or budget to try.
`.trim();

export const PATTERN_SUMMARY_FOR_CHOOSE = `
From interviews:
- ${SEGMENTS.logistics.label}: weekly pain, costly workarounds, owner can buy under ~$1k/mo, one paid-pilot interest.
- ${SEGMENTS.clinics.label}: frequent pain but software skepticism; no paid commitment yet.
- ${SEGMENTS.agencies.label}: mild infrequent pain; "sounds useful" only.

Adjacent larger-sounding market (enterprise supply-chain platforms): no interviews, no pilot interest — only a big TAM estimate from a blog.
`.trim();

export function calledResearch(
  toolCalls: ReadonlyArray<{ name: string }>,
): boolean {
  return toolCalls.some(
    (call) => call.name === "exa_agent_run" || call.name === "web_search",
  );
}
