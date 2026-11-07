import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/**
 * Shared generative-UI vocabulary for Pearl chat.
 *
 * One catalog for web and mobile so the agent emits a single spec both
 * registries can render. Uses the React element-tree schema (zod only) so the
 * agent bundle never imports a renderer.
 */
export const chatCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        direction: z.enum(["vertical", "horizontal"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      slots: ["default"],
      description: "Flex stack for grouping related elements",
    },
    Card: {
      props: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Container card; use as the root of every generated UI",
    },
    Divider: {
      props: z.object({}),
      description: "Horizontal rule between sections",
    },
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["1", "2", "3"]).nullable(),
      }),
      description: "Section heading",
    },
    Text: {
      props: z.object({
        text: z.string(),
        muted: z.boolean().nullable(),
      }),
      description: "Body copy inside a card",
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        hint: z.string().nullable(),
      }),
      description: "Single labeled metric value",
    },
    Badge: {
      props: z.object({
        label: z.string(),
        tone: z.enum(["neutral", "positive", "negative", "warning"]).nullable(),
      }),
      description: "Compact status or category chip",
    },
    ComparisonBar: {
      props: z.object({
        leftLabel: z.string(),
        leftValue: z.number(),
        rightLabel: z.string(),
        rightValue: z.number(),
        caption: z.string().nullable(),
      }),
      description:
        "Horizontal two-way share bar for races or A/B splits (e.g. Yes vs No %). Values are percents.",
    },
    Table: {
      props: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
      description: "Simple data table with string cells",
    },
    Image: {
      props: z.object({
        src: z.string(),
        alt: z.string().nullable(),
      }),
      description: "Image from an https URL only",
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "secondary", "outline"]).nullable(),
      }),
      description:
        "Pressable control. Bind press to the reply action to continue the chat.",
    },
  },
  actions: {
    reply: {
      params: z.object({
        message: z.string(),
      }),
      description:
        "Send message as the user's next chat turn when a Button is pressed",
    },
  },
});

export type ChatCatalog = typeof chatCatalog;

export const JSON_RENDER_CUSTOM_RULES = [
  "Emit a UI spec for structured answers: comparisons, metrics, tables, short multiple-choice, and numeric scoreboards (elections, polls, head-to-heads, KPI splits). Ordinary replies and exploratory thinking-together turns stay prose with no spec. Do not wait for the user to ask for a chart.",
  "At most one spec per reply. Prefer a ```spec fence. Always use Card as the root element.",
  "For two-way % races prefer ComparisonBar (left/right labels + percent values), then pair with Metric/Badge for counts, margin, and status. Shape: Card → ComparisonBar + horizontal Stack of Metrics. Keep 1–2 sentences of prose outside the fence.",
  "Buttons that continue the conversation must bind press to the reply action with a concrete message string. Do not invent component names outside this catalog.",
  "Image src must be an https URL. Prefer ComparisonBar, Metric, Badge, Table, and Stack for dense factual layouts.",
] as const;

/** System prompt fragment for the eve chat channel (inline generative UI). */
export function chatJsonRenderPrompt(): string {
  return chatCatalog.prompt({
    mode: "inline",
    customRules: [...JSON_RENDER_CUSTOM_RULES],
  });
}
