import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

const searchResultItem = z.object({
  title: z.string(),
  detail: z.string().nullable(),
  meta: z.string().nullable(),
  /** Optional https image URL (prefer for product results). */
  image: z.string().nullable(),
});

const placePin = z.object({
  label: z.string(),
  /** 0–100 horizontal position inside the schematic map. */
  x: z.number(),
  /** 0–100 vertical position inside the schematic map. */
  y: z.number(),
  detail: z.string().nullable(),
});

const encyclopediaSection = z.object({
  heading: z.string(),
  body: z.string(),
});

const infoboxPair = z.object({
  label: z.string(),
  value: z.string(),
});

const explainerStep = z.object({
  heading: z.string(),
  body: z.string(),
});

const regionBar = z.object({
  label: z.string(),
  value: z.number(),
  hint: z.string().nullable(),
});

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
    SearchResults: {
      props: z.object({
        kind: z.enum(["web", "product"]).nullable(),
        items: z.array(searchResultItem).min(1).max(8),
      }),
      description:
        "Web or product search hits. Each item has title, optional detail, optional meta (domain or price), and optional https image (use for products).",
    },
    PlaceMap: {
      props: z.object({
        title: z.string().nullable(),
        address: z.string().nullable(),
        pins: z.array(placePin).min(1).max(8),
      }),
      description:
        "Schematic map with labeled pins (x/y 0–100). One pin for a location; several for nearby places.",
    },
    NewsBrief: {
      props: z.object({
        kicker: z.string().nullable(),
        headline: z.string(),
        dek: z.string().nullable(),
        bullets: z.array(z.string()).nullable(),
        sources: z.array(z.string()).nullable(),
      }),
      description: "News story or situation brief with headline, dek, bullets, and sources",
    },
    Encyclopedia: {
      props: z.object({
        title: z.string(),
        lead: z.string(),
        image: z.string().nullable(),
        infobox: z.array(infoboxPair).nullable(),
        sections: z.array(encyclopediaSection).nullable(),
      }),
      description:
        "Encyclopedia-style entry: title, lead, optional https image, optional infobox pairs and short sections",
    },
    Pronounce: {
      props: z.object({
        word: z.string(),
        ipa: z.string().nullable(),
        syllables: z.string().nullable(),
        note: z.string().nullable(),
        /** Optional https audio clip; otherwise the UI may TTS `spoken` or `word`. */
        audio: z.string().nullable(),
        /** BCP-47 language tag for TTS (e.g. it-IT). */
        lang: z.string().nullable(),
        /** Exact text to speak; defaults to word. */
        spoken: z.string().nullable(),
      }),
      description:
        "How to pronounce a word: surface form, IPA, stressed syllables; set lang for AI speech playback",
    },
    Phrase: {
      props: z.object({
        sourceLanguage: z.string(),
        targetLanguage: z.string(),
        phrase: z.string(),
        translation: z.string(),
        literal: z.string().nullable(),
        /** Optional https audio clip of the translation. */
        audio: z.string().nullable(),
        /** BCP-47 language tag for AI speech of the translation (e.g. ja-JP). */
        lang: z.string().nullable(),
        /** Exact text to speak; defaults to translation. */
        spoken: z.string().nullable(),
      }),
      description:
        "How to say a phrase in another language, with optional literal gloss; set lang for AI speech playback",
    },
    GuitarChord: {
      props: z.object({
        name: z.string(),
        /** Six strings low-E → high-e. -1 muted, 0 open, 1+ fret. Starting/default voicing. */
        frets: z.array(z.number()).length(6),
        baseFret: z.number().nullable(),
        /** Optional extra fingerings; the UI also browses a built-in chord library. */
        voicings: z
          .array(
            z.object({
              label: z.string(),
              frets: z.array(z.number()).length(6),
              baseFret: z.number().nullable(),
            }),
          )
          .nullable(),
      }),
      description:
        "Interactive guitar chord diagram. frets is six numbers (low E to high e): -1 muted, 0 open, positive fret. Emit the best default fingering; UI can browse voicings and a shared library.",
    },
    TheoryBoard: {
      props: z.object({
        title: z.string().nullable(),
        progression: z.array(z.string()).nullable(),
        highlightKey: z.string().nullable(),
        showCircle: z.boolean().nullable(),
      }),
      description:
        "Music theory board: roman-numeral progression chips and optional circle of fifths with one key highlighted",
    },
    RegionChart: {
      props: z.object({
        title: z.string().nullable(),
        unit: z.string().nullable(),
        regions: z.array(regionBar).min(1).max(12),
      }),
      description:
        "Labeled horizontal bars for regional votes or data maps (not a geo basemap)",
    },
    Explainer: {
      props: z.object({
        title: z.string(),
        steps: z.array(explainerStep).min(1).max(8),
      }),
      description: "Teach breakdown: titled numbered steps with a short sentence each",
    },
    Recipe: {
      props: z.object({
        title: z.string(),
        time: z.string().nullable(),
        yield: z.string().nullable(),
        ingredients: z.array(z.string()).min(1),
        method: z.array(z.string()).min(1),
      }),
      description: "Recipe card with time, yield, ingredients, and numbered method",
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
  "Emit a UI spec for structured answers of these kinds: web/product search, location or place maps, news briefs, encyclopedia entries, pronunciation, foreign-language phrases, guitar chords, music theory (progressions / circle of fifths), vote or regional charts, tables, explainers, and recipes. Ordinary replies and exploratory thinking-together turns stay prose with no spec.",
  "At most one spec per reply. Prefer a ```spec fence. Always use Card as the root element; put the specialized component (SearchResults, PlaceMap, NewsBrief, Encyclopedia, Pronounce, Phrase, GuitarChord, TheoryBoard, RegionChart, Table, Explainer, Recipe, ComparisonBar) inside it.",
  "For two-way % races prefer ComparisonBar; for multi-region shares use RegionChart. Keep 1–2 sentences of prose outside the fence.",
  "Buttons that continue the conversation must bind press to the reply action with a concrete message string. Do not invent component names outside this catalog.",
  "Image src must be an https URL. Prefer the dedicated answer components over assembling the same layout from Stack/Text alone.",
] as const;

/** System prompt fragment for the eve chat channel (inline generative UI). */
export function chatJsonRenderPrompt(): string {
  return chatCatalog.prompt({
    mode: "inline",
    customRules: [...JSON_RENDER_CUSTOM_RULES],
  });
}
