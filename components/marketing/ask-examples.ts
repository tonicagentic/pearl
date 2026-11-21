import type { Spec } from "@json-render/core";

export type AskTask = {
  readonly verb: string;
  readonly rest: string;
};

export type AskSlide =
  | {
      readonly slug: string;
      readonly tab: string;
      readonly kind: "tasks";
      readonly prompt: string;
      readonly tasks: readonly AskTask[];
    }
  | {
      readonly slug: string;
      readonly tab: string;
      readonly kind: "card";
      readonly prompt: string;
      readonly outcome: string;
      readonly cards: readonly Spec[];
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

export const ASK_EXAMPLES: readonly AskSlide[] = [
  {
    slug: "tasks",
    tab: "Tasks",
    kind: "tasks",
    prompt: "Find me three things you can help me with now.",
    tasks: [
      { verb: "Archived", rest: "61 newsletter threads in Gmail" },
      { verb: "Booked", rest: "UCSF Imaging — Thu 2:40p" },
      { verb: "Drafted", rest: "Mercury outreach (waiting on you)" },
    ],
  },
  {
    slug: "insurance",
    tab: "Insurance",
    kind: "card",
    prompt:
      "MRI of my right knee — Anthem PPO. How much, and who’s in-network near Mission?",
    outcome:
      "Three in-network options this week. UCSF is usually cheapest after Anthem’s rate.",
    cards: [insuranceCompare],
  },
  {
    slug: "portfolio",
    tab: "Portfolio",
    kind: "card",
    prompt:
      "Help me build a calm portfolio site — warm paper, passworded client galleries.",
    outcome:
      "Scaffolding Next.js with a home grid, project pages, and shared-password galleries.",
    cards: [portfolioTimeline],
  },
  {
    slug: "taxes",
    tab: "Taxes",
    kind: "card",
    prompt:
      "Contractor ~$140k, California, single — how much should I put aside for taxes?",
    outcome:
      "With $8k SEP-IRA in, set aside about $3,300–$3,700/mo — confirm with your CPA.",
    cards: [taxesChart],
  },
  {
    slug: "prospecting",
    tab: "Prospecting",
    kind: "card",
    prompt:
      "Design systems for mid-size fintechs — who should I email this quarter?",
    outcome:
      "Draft ready for Mercury — two sentences, won’t send until you approve.",
    cards: [prospectingDraft],
  },
  {
    slug: "coffee-shop",
    tab: "Coffee shop",
    kind: "card",
    prompt:
      "Good place in SF for a coffee shop — neighborhood regulars over office lunch.",
    outcome:
      "Irving balances daytime foot traffic and rent without FiDi saturation.",
    cards: [coffeeCompare],
  },
  {
    slug: "inbox",
    tab: "Inbox",
    kind: "card",
    prompt: "Inbox is a mess — archive the noise, keep anything that needs me.",
    outcome:
      "Archived 61. Draft for Maya is ready. Invoices left unread and starred.",
    cards: [inboxBatch, inboxDraft],
  },
];
