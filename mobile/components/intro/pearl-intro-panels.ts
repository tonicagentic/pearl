import type { Spec } from "@json-render/core";

export type PearlIntroPanelId = "easier" | "handled" | "list";

export type PearlIntroTask = {
  readonly verb: string;
  readonly rest: string;
};

export type PearlIntroCard =
  | { readonly kind: "spec"; readonly spec: Spec }
  | { readonly kind: "tasks"; readonly tasks: readonly PearlIntroTask[] };

export type PearlIntroTurn =
  | { readonly role: "user"; readonly text: string }
  | {
      readonly role: "assistant";
      readonly text: string;
      readonly card?: PearlIntroCard;
    };

export type PearlIntroPanel = {
  readonly id: PearlIntroPanelId;
  readonly title: string;
  readonly body: string;
  /** Two-beat thread: user → reply (+ card) → user → reply. */
  readonly turns: readonly PearlIntroTurn[];
};

/** Homepage EverydayVisual — AI investments table. */
const investmentsSpec: Spec = {
  root: "card",
  elements: {
    card: {
      type: "Card",
      props: { title: null, description: null },
      children: ["table"],
    },
    table: {
      type: "Table",
      props: {
        columns: ["Company", "Round", "Lead"],
        rows: [
          ["OpenAI", "$40B", "SoftBank"],
          ["Anthropic", "$13B", "Spark"],
          ["xAI", "$10B", "Valor"],
        ],
      },
      children: [],
    },
  },
};

/** Homepage Portfolio Ask example — trimmed timeline. */
const portfolioSpec: Spec = {
  root: "card",
  elements: {
    card: {
      type: "Card",
      props: { title: "Portfolio build", description: null },
      children: ["timeline"],
    },
    timeline: {
      type: "Timeline",
      props: {
        visibleCount: null,
        events: [
          {
            id: "structure",
            when: "past",
            time: "Done",
            title: "Site structure",
            detail: "Home grid, project pages, about.",
          },
          {
            id: "gallery",
            when: "now",
            time: "Now",
            title: "Warm paper gallery",
            detail: "Serif type, full-bleed selects.",
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
      children: [],
    },
  },
};

/**
 * Shared copy + thread previews for the signed-out intro and Settings → About.
 * Prompts / cards mirror homepage hero and capability-band examples.
 */
export const PEARL_INTRO_PANELS: readonly PearlIntroPanel[] = [
  {
    id: "easier",
    title: "Make everyday easier",
    body: "One thread for whatever you need — research, drafts, bookings, and the small stuff that piles up.",
    turns: [
      {
        role: "user",
        text: "What are the biggest AI investments this year?",
      },
      {
        role: "assistant",
        text: "Ranked by round size — here are the ones that moved the needle.",
        card: { kind: "spec", spec: investmentsSpec },
      },
      {
        role: "user",
        text: "Who led the Anthropic round?",
      },
      {
        role: "assistant",
        text: "Spark Capital led the $13B raise.",
      },
    ],
  },
  {
    id: "handled",
    title: "Consider it handled",
    body: "Delegate to specialists with a cloud computer, and connect your apps so Pearl can finish the work.",
    turns: [
      {
        role: "user",
        text: "Help me build a calm portfolio site — warm paper, passworded client galleries.",
      },
      {
        role: "assistant",
        text: "Scaffolding Next.js with a home grid and shared-password galleries.",
        card: { kind: "spec", spec: portfolioSpec },
      },
      {
        role: "user",
        text: "Ship it when the gallery feels ready.",
      },
      {
        role: "assistant",
        text: "On it — specialist’s building in the sandbox, then we’ll deploy.",
      },
    ],
  },
  {
    id: "list",
    title: "Tap it off your list",
    body: "Pearl suggests what to do next from what it knows about you. Tap once and it runs the action.",
    turns: [
      {
        role: "user",
        text: "Find me three things you can help me with now.",
      },
      {
        role: "assistant",
        text: "From your inbox and calendar — tap any to run it.",
        card: {
          kind: "tasks",
          tasks: [
            { verb: "Archive", rest: "61 newsletter threads in Gmail" },
            { verb: "Draft", rest: "reply to Maya on the hiring thread" },
            { verb: "Book", rest: "UCSF Imaging — Thu 2:40p" },
          ],
        },
      },
      {
        role: "user",
        text: "Archive the newsletters.",
      },
      {
        role: "assistant",
        text: "Archived 61 threads in Gmail.",
      },
    ],
  },
] as const;
