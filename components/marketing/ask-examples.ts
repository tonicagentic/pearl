import type { Spec } from "@json-render/core";

export type AskMessage =
  | { readonly role: "user"; readonly text: string }
  | {
      readonly role: "assistant";
      readonly text: string;
      readonly spec?: Spec;
    };

export type AskExample = {
  readonly slug: string;
  readonly tab: string;
  readonly messages: readonly AskMessage[];
};

function cardSpec(
  childId: string,
  child: {
    readonly type: string;
    readonly props: Record<string, unknown>;
  },
  title: string | null = null,
): Spec {
  return {
    root: "card",
    elements: {
      card: {
        type: "Card",
        props: { title, description: null },
        children: [childId],
      },
      [childId]: {
        type: child.type,
        props: child.props,
        children: [],
      },
    },
  };
}

const insuranceCompare = cardSpec(
  "compare",
  {
    type: "ComparisonCard",
    props: {
      traitLabels: ["Your share (est.)", "Opening this week", "Near Mission"],
      options: [
        {
          id: "ucsf",
          name: "UCSF Imaging",
          headline: "Mission Bay · Anthem contracted",
          traits: ["~$220–$280 after deductible", "Thu 2:40p", "Yes · 1.4 mi"],
        },
        {
          id: "radiologica",
          name: "Radiologica",
          headline: "Valencia St · walk-in friendly",
          traits: ["~$260–$320", "Wed 11:15a", "Yes · 0.8 mi"],
        },
        {
          id: "cpmc",
          name: "California Pacific",
          headline: "Pacific Campus",
          traits: ["~$300–$360", false, "Yes · 2.1 mi"],
        },
      ],
      recommendedId: "ucsf",
      reason:
        "UCSF is usually cheapest after Anthem’s contracted rate and has an opening this week.",
    },
  },
  "In-network MRI near Mission",
);

const portfolioTimeline = cardSpec(
  "timeline",
  {
    type: "Timeline",
    props: {
      visibleCount: null,
      events: [
        {
          id: "structure",
          when: "past",
          time: "Done",
          title: "Site structure",
          detail: "Home grid, project pages, about, contact.",
        },
        {
          id: "gallery",
          when: "now",
          time: "Now",
          title: "Warm paper gallery",
          detail: "Serif type, full-bleed selects, quiet chrome.",
        },
        {
          id: "clients",
          when: "future",
          time: "Next",
          title: "Passworded client galleries",
          detail: "Shared password per shoot; no public index.",
        },
        {
          id: "ship",
          when: "future",
          time: "Ship",
          title: "Deploy + custom domain",
          detail: null,
        },
      ],
    },
  },
  "Portfolio build",
);

const taxesChart = cardSpec(
  "chart",
  {
    type: "Chart",
    props: {
      label: "Monthly tax set-aside",
      value: "$3,500",
      delta: "~30% of profit",
      trend: "flat",
      upIsGood: true,
      points: [
        3200, 3350, 3400, 3500, 3450, 3600, 3550, 3500, 3480, 3520, 3500, 3500,
      ],
      visibleCount: 12,
      variant: "area",
    },
  },
  null,
);

const prospectingDraft = cardSpec(
  "draft",
  {
    type: "EmailDraft",
    props: {
      to: "jordan.lee@mercury.com",
      cc: null,
      bcc: null,
      subject: "Design systems at Mercury — quick chat?",
      body: "Jordan —\n\nI’ve been reading through Mercury’s public component docs and liked how the tokens stay boring on purpose. We help mid-size fintechs ship design systems without a rewrite.\n\nOpen to a 15-minute chat next week?\n\n— Alex",
      accountId: null,
      threadId: null,
    },
  },
  null,
);

const coffeeCompare = cardSpec(
  "compare",
  {
    type: "ComparisonCard",
    props: {
      traitLabels: ["Rent pressure", "Neighborhood regulars", "Daytime foot traffic"],
      options: [
        {
          id: "irving",
          name: "Irving near 19th",
          headline: "Outer Sunset · residents over offices",
          traits: ["Moderate", "Strong local base", "Steady daytime"],
        },
        {
          id: "cortland",
          name: "Cortland (Bernal)",
          headline: "Walkable strip · household income",
          traits: ["Moderate–high", "Loyal regulars", "Evenings too"],
        },
        {
          id: "precita",
          name: "Mission near Precita",
          headline: "Café density rising",
          traits: ["Higher", "Mixed", "Weekend heavy"],
        },
      ],
      recommendedId: "irving",
      reason:
        "Irving balances daytime foot traffic and rent without FiDi saturation — best fit if you want neighborhood regulars first.",
    },
  },
  "SF shortlist",
);

const inboxBatch = cardSpec(
  "batch",
  {
    type: "EmailBatch",
    props: {
      items: [
        {
          accountId: "acct_1",
          threadId: "thread_news_1",
          action: "archive",
          subject: "Weekly product digest",
          from: "news@example.com",
        },
        {
          accountId: "acct_1",
          threadId: "thread_news_2",
          action: "archive",
          subject: "Your receipt from Notion",
          from: "noreply@notion.so",
        },
        {
          accountId: "acct_1",
          threadId: "thread_promo",
          action: "archive",
          subject: "30% off this weekend only",
          from: "hello@store.example",
        },
        {
          accountId: "acct_1",
          threadId: "thread_read",
          action: "mark_read",
          subject: "FYI: calendar invite updated",
          from: "calendar-notification@google.com",
        },
      ],
    },
  },
  "Proposed cleanup",
);

const inboxDraft = cardSpec(
  "draft",
  {
    type: "EmailDraft",
    props: {
      to: "maya@studio.example",
      cc: null,
      bcc: null,
      subject: "Re: Design systems contractor — next steps",
      body: "Maya —\n\nThanks for the note — I’d love to keep talking. I’m free Thu 2–4p PT or Fri morning if either works.\n\nHappy to send a short case study ahead of time.\n\n— Alex",
      accountId: "acct_1",
      threadId: "thread_hiring",
    },
  },
  null,
);

export const ASK_EXAMPLES: readonly AskExample[] = [
  {
    slug: "insurance",
    tab: "Insurance",
    messages: [
      {
        role: "user",
        text: "I need an MRI of my right knee. I’m on Anthem PPO through work — how much am I looking at, and who’s in-network near Mission?",
      },
      {
        role: "assistant",
        text: "From the SBC you shared: $500 imaging deductible left, then 20% coinsurance. In-network MRI facilities near Mission typically bill $1,100–$1,800 for a knee study — your share lands around $220–$360 after the deductible.",
      },
      {
        role: "user",
        text: "Who would you book with?",
      },
      {
        role: "assistant",
        text: "Three in-network options with openings this week. UCSF is usually cheapest after Anthem’s contracted rate. Want me to draft a referral request for your PCP?",
        spec: insuranceCompare,
      },
    ],
  },
  {
    slug: "portfolio",
    tab: "Portfolio",
    messages: [
      {
        role: "user",
        text: "I shoot weddings and editorial portraits. Can you help me build a portfolio site that feels calm, not template-y?",
      },
      {
        role: "assistant",
        text: "Yes. I’d keep it sparse: full-bleed work first, short about, and a quiet contact. Two directions — warm paper + serif, or cool concrete + sans. Which feels closer?",
      },
      {
        role: "user",
        text: "Warm paper. And I need a passworded client gallery somehow.",
      },
      {
        role: "assistant",
        text: "Got it. Scaffolding a Next.js site with a home grid, project pages, and a simple client gallery behind a shared password. Drop a Drive folder of selects when you’re ready.",
        spec: portfolioTimeline,
      },
    ],
  },
  {
    slug: "taxes",
    tab: "Taxes",
    messages: [
      {
        role: "user",
        text: "How much should I put aside for taxes? I’m a contractor, ~$140k this year so far, California, single, no big deductions yet.",
      },
      {
        role: "assistant",
        text: "Rough cut for CA + federal self-employment: plan on ~30–35% of profit. On $140k that’s about $3,500–$4,100 a month if income stays even. I’ll refine once you share Q1–Q3 1099s and any retirement or health premiums.",
      },
      {
        role: "user",
        text: "I put $8k into a SEP-IRA already.",
      },
      {
        role: "assistant",
        text: "That helps. Updated set-aside: closer to 28–32%, or about $3,300–$3,700/mo. This isn’t advice — worth confirming quarterly estimates with your CPA before April.",
        spec: taxesChart,
      },
    ],
  },
  {
    slug: "prospecting",
    tab: "Prospecting",
    messages: [
      {
        role: "user",
        text: "We’re selling design systems work to mid-size fintechs. Who should I actually email this quarter?",
      },
      {
        role: "assistant",
        text: "I pulled 12 companies that recently raised or posted design-system / platform roles. Best first outreach: Heads of Design or Staff Product Designers — not generic recruiters. Top three: Mercury, Ramp-adjacent tooling shops, and a Series B payments API based in NYC.",
      },
      {
        role: "user",
        text: "Draft something short for the Mercury person.",
      },
      {
        role: "assistant",
        text: "Draft ready — two sentences, mentions their public component docs, asks for a 15-minute chat. I won’t send until you approve.",
        spec: prospectingDraft,
      },
    ],
  },
  {
    slug: "coffee-shop",
    tab: "Coffee shop",
    messages: [
      {
        role: "user",
        text: "I’m thinking about opening a coffee shop. What’s a good place in San Francisco to do this?",
      },
      {
        role: "assistant",
        text: "Depends on rent vs. daytime density. Using ACS demographics, LEHD workplace counts, and recent retail listings: Outer Sunset and Excelsior score well on residents-per-café; SoMa and FiDi have high weekday traffic but brutal rent and saturation.",
      },
      {
        role: "user",
        text: "I care more about neighborhood regulars than office lunch.",
      },
      {
        role: "assistant",
        text: "Shortlist below — Irving balances daytime foot traffic and rent without FiDi saturation. Want a one-pager with rent comps and competitor maps next?",
        spec: coffeeCompare,
      },
    ],
  },
  {
    slug: "inbox",
    tab: "Inbox",
    messages: [
      {
        role: "user",
        text: "My inbox is a mess. Can you clean it up from here — archive the noise, keep anything that needs me?",
      },
      {
        role: "assistant",
        text: "I scanned the last 7 days: 214 unread. 61 look like newsletters/receipts, 18 need a reply, 4 look time-sensitive. Propose archiving the noise first — nothing irreversible without you.",
        spec: inboxBatch,
      },
      {
        role: "user",
        text: "Archive the noise and draft the hiring thread. Leave the invoices for me.",
      },
      {
        role: "assistant",
        text: "Archived 61. Draft for Maya on the hiring thread is ready — warm yes + two scheduling options. Invoices left unread and starred.",
        spec: inboxDraft,
      },
    ],
  },
];
