import type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "@/lib/custom-agents/mark";

/**
 * Marketing mirror of the seeded agent_template rows in
 * `lib/db/migrations/0050_agent_directory.sql`. Kept static so signed-out
 * marketing pages prerender without a DB round trip.
 */
export type MarketplaceExample = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly featured: boolean;
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
};

export const MARKETPLACE_EXAMPLES: readonly MarketplaceExample[] = [
  {
    slug: "research-desk",
    name: "Research desk",
    description:
      "A research and fact-check desk that prefers live web search and dated, sourced claims over training-only answers.",
    category: "Research",
    featured: true,
    accent: "#3B82F6",
    markShape: "diamond",
    markTalk: "hinge",
    markBrows: "line",
    markGaze: "wander",
  },
  {
    slug: "inbox-clerk",
    name: "Inbox clerk",
    description:
      "Triages your Gmail: surfaces what needs a reply, drafts when asked, and never sends without you.",
    category: "Mail",
    featured: true,
    accent: "#F97316",
    markShape: "oval",
    markTalk: "chatter",
    markBrows: "none",
    markGaze: "wander",
  },
  {
    slug: "day-brief",
    name: "Day brief",
    description:
      "A morning brief from calendar and mail: what's on today, what's waiting, and what can wait.",
    category: "Home",
    featured: true,
    accent: "#EAB308",
    markShape: "trap",
    markTalk: "lift",
    markBrows: "none",
    markGaze: "still",
  },
  {
    slug: "calendar-keeper",
    name: "Calendar keeper",
    description:
      "Finds open time across Google Calendar and iCloud, and drafts holds without booking until you say so.",
    category: "Calendar",
    featured: false,
    accent: "#22C55E",
    markShape: "square",
    markTalk: "hinge",
    markBrows: "line",
    markGaze: "wander",
  },
  {
    slug: "copy-editor",
    name: "Copy editor",
    description:
      "Line-edits drafts so they read like a person wrote them. Shows every change and why.",
    category: "Writing",
    featured: false,
    accent: "#8B5CF6",
    markShape: "oval",
    markTalk: "lift",
    markBrows: "none",
    markGaze: "still",
  },
  {
    slug: "repo-guide",
    name: "Repo guide",
    description:
      "Explains changes in your GitHub repos: what landed, what it touches, and what to review.",
    category: "Engineering",
    featured: false,
    accent: "#64748B",
    markShape: "diamond",
    markTalk: "chatter",
    markBrows: "line",
    markGaze: "wander",
  },
  {
    slug: "sheets-analyst",
    name: "Sheets analyst",
    description:
      "Reads Google Sheets you point it at and answers with the numbers that are actually there.",
    category: "Data",
    featured: false,
    accent: "#2DD4BF",
    markShape: "square",
    markTalk: "hinge",
    markBrows: "none",
    markGaze: "still",
  },
  {
    slug: "deploy-watch",
    name: "Deploy watch",
    description:
      "Checks Vercel deployments on a weekday cadence and tells you what shipped or broke.",
    category: "Engineering",
    featured: false,
    accent: "#EC4899",
    markShape: "trap",
    markTalk: "chatter",
    markBrows: "line",
    markGaze: "wander",
  },
] as const;
