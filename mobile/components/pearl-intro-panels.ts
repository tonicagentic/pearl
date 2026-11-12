export type PearlIntroPanelId =
  | "meet"
  | "research"
  | "agents"
  | "loop"
  | "privacy";

export type PearlIntroBubbleKind = "user" | "pearl" | "status";

export type PearlIntroBubble = {
  readonly text: string;
  readonly kind: PearlIntroBubbleKind;
  /** Absolute position as % of graphic area. */
  readonly top: number;
  readonly left: number;
  /** Degrees of rotation. */
  readonly rotate: number;
};

export type PearlIntroPanel = {
  readonly id: PearlIntroPanelId;
  readonly title: string;
  readonly body: string;
  readonly bubbles: readonly PearlIntroBubble[];
};

/** Shared copy + collage seeds for the signed-out intro and Settings → About. */
export const PEARL_INTRO_PANELS: readonly PearlIntroPanel[] = [
  {
    id: "meet",
    title: "Meet Pearl, your agentic assistant.",
    body: "Pearl helps you work with agents.",
    bubbles: [
      {
        text: "Plan the launch checklist",
        kind: "user",
        top: 8,
        left: 4,
        rotate: -8,
      },
      {
        text: "On it.",
        kind: "pearl",
        top: 18,
        left: 58,
        rotate: 6,
      },
      {
        text: "Open the repo and draft a PR",
        kind: "user",
        top: 58,
        left: 8,
        rotate: 4,
      },
      {
        text: "Working in the sandbox…",
        kind: "status",
        top: 72,
        left: 48,
        rotate: -5,
      },
    ],
  },
  {
    id: "research",
    title: "Ask Pearl anything",
    body: "It can find answers from the web and your connected sources, and do work with a cloud computer — open sites, edit files, and take actions on your apps.",
    bubbles: [
      {
        text: "Compare these three vendors",
        kind: "user",
        top: 6,
        left: 8,
        rotate: -7,
      },
      {
        text: "Pulled from the web + Sheets",
        kind: "pearl",
        top: 24,
        left: 48,
        rotate: 5,
      },
      {
        text: "Browser · docs open",
        kind: "status",
        top: 58,
        left: 4,
        rotate: 4,
      },
      {
        text: "File updated in workspace",
        kind: "pearl",
        top: 72,
        left: 40,
        rotate: -6,
      },
    ],
  },
  {
    id: "agents",
    title: "Specialized agents on call",
    body: "Pearl can delegate work to specialized agents built by Tonic Agentic — focused helpers for research, coding, and more.",
    bubbles: [
      {
        text: "Hand this to the coder agent",
        kind: "user",
        top: 8,
        left: 6,
        rotate: -7,
      },
      {
        text: "Delegating to Coder…",
        kind: "status",
        top: 22,
        left: 52,
        rotate: 6,
      },
      {
        text: "Research agent: sources ready",
        kind: "pearl",
        top: 58,
        left: 4,
        rotate: 4,
      },
      {
        text: "Tonic Agentic",
        kind: "status",
        top: 74,
        left: 48,
        rotate: -5,
      },
    ],
  },
  {
    id: "loop",
    title: "Stay in the loop",
    body: "Message or call Pearl in the app. Share updates, ask questions, or change directions. When something needs your attention, Pearl gets in touch.",
    bubbles: [
      {
        text: "Need a quick decision",
        kind: "pearl",
        top: 10,
        left: 12,
        rotate: -5,
      },
      {
        text: "Call me when you’re free",
        kind: "user",
        top: 30,
        left: 50,
        rotate: 6,
      },
      {
        text: "Incoming call",
        kind: "status",
        top: 60,
        left: 8,
        rotate: 3,
      },
      {
        text: "Ship it",
        kind: "user",
        top: 74,
        left: 52,
        rotate: -4,
      },
    ],
  },
  {
    id: "privacy",
    title: "Open source, yours to run",
    body: "Pearl is open source — run it yourself to keep your data private. Hosted Pearl is $10 per month plus usage (models, research, sandboxes, and more).",
    bubbles: [
      {
        text: "Self-host on your machine",
        kind: "user",
        top: 8,
        left: 6,
        rotate: -6,
      },
      {
        text: "Your data stays with you",
        kind: "pearl",
        top: 24,
        left: 48,
        rotate: 5,
      },
      {
        text: "$10/mo + usage",
        kind: "status",
        top: 60,
        left: 8,
        rotate: 3,
      },
      {
        text: "Or subscribe on Stripe",
        kind: "pearl",
        top: 74,
        left: 44,
        rotate: -4,
      },
    ],
  },
] as const;
