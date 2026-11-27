import { auto, type DynamicModelContext } from "eve/models";
import type { JsonObject } from "eve/events";

import {
  classifyPearlHeuristic,
  type PearlLane,
} from "@/lib/pearl-lane";

import {
  GATEWAY_PROVIDER_OPTIONS,
  GATEWAY_ZDR_PROVIDER_OPTIONS,
} from "./gateway-policy.ts";
import { setPearlLane } from "./lib/lane-state.ts";
import {
  DEFAULT_MODEL,
  readClientModelSelection,
  type ScannedMessageLike,
} from "./model-selection.ts";

/**
 * Parent Pearl model routing via eve `auto()` (Decide / Jev).
 *
 * Precedence: AGENT_MODEL_OVERRIDE → client picker pin → `auto()`.
 * Tool surfaces stay on pearl-lane heuristics (setPearlLane), not on which
 * model Decide picks — so routine mini turns can still search.
 */

export type { PearlLane };

/** Routine default / auto fallback — feelings, lookups, short answers, explain. */
export const PEARL_ROUTINE_MODEL = "thinkingmachines/inkling-2-mini";

/** Quick path uses the same routine model as auto's fallback. */
export const PEARL_QUICK_MODEL = PEARL_ROUTINE_MODEL;
export const PEARL_QUICK_FALLBACK = "openai/gpt-6.1-sol";

/**
 * Mini (and Ultramarine) often lack a catalog US zone pin; ZDR + no-training
 * without inferenceRegion. Sol keeps the full US + ZDR policy.
 */
export const PEARL_ROUTINE_GATEWAY_OPTIONS = {
  ...GATEWAY_ZDR_PROVIDER_OPTIONS,
} as const;

const DYNAMIC = Symbol.for("eve.dynamic");

type AutoSelection = {
  readonly model: string;
  readonly reasoning?: "low" | "medium" | "high";
  readonly modelOptions?: {
    readonly providerOptions?: {
      readonly gateway?: JsonObject;
    };
  };
};

function selectionWithGateway(
  model: string,
  gateway: JsonObject,
  reasoning: "low" | "medium" = "low",
): AutoSelection {
  return {
    model,
    reasoning,
    modelOptions: {
      providerOptions: {
        gateway,
      },
    },
  };
}

function unwrapDynamic(
  sentinel: unknown,
): (ctx: DynamicModelContext) => Promise<AutoSelection> | AutoSelection {
  const fn = (sentinel as Record<symbol, unknown>)[DYNAMIC];
  if (typeof fn !== "function") {
    throw new Error("Expected eve auto()/defineDynamic sentinel");
  }
  return fn as (
    ctx: DynamicModelContext,
  ) => Promise<AutoSelection> | AutoSelection;
}

/** Descriptions Decide reads — grounded in prod chat mix (feelings / lookup / explain vs build). */
export const PEARL_AUTO_OPTION_DESCRIPTIONS = {
  [PEARL_ROUTINE_MODEL]:
    "Default Pearl: light conversation, brief mood shares, short factual " +
    "answers with search, everyday explanations, mail/calendar lookups — " +
    "fast and cheap. Prefer this for most turns.",
  "openai/gpt-6.1-sol":
    "Harder judgment, careful multi-step reasoning, drafting, or emotional " +
    "sit-with turns where a quiet accompanying voice matters — plain " +
    "reflection without therapist/person-performing care, when nuance beats " +
    "speed.",
  "paperinstruments/ultramarine-1-flash":
    "Long documents, diligence, research synthesis, lead/ICP analysis, and " +
    "other professional knowledge work on pasted or fetched material.",
} as const;

export const PEARL_AUTO_MODEL_IDS = Object.keys(
  PEARL_AUTO_OPTION_DESCRIPTIONS,
) as readonly (keyof typeof PEARL_AUTO_OPTION_DESCRIPTIONS)[];

/**
 * eve Automatic Model Selection for Auto (no pin / override).
 * Exported so tests can assert option coverage without running Decide.
 */
export const pearlAutoModel = auto({
  fallback: selectionWithGateway(PEARL_ROUTINE_MODEL, {
    ...PEARL_ROUTINE_GATEWAY_OPTIONS,
    tags: ["agent:pearl", "auto:fallback"],
  }),
  modelOptions: {
    providerOptions: {
      gateway: {
        ...GATEWAY_PROVIDER_OPTIONS,
        tags: ["role:pearl-auto", "agent:pearl"],
      },
    },
  },
  options: {
    [PEARL_ROUTINE_MODEL]: {
      description: PEARL_AUTO_OPTION_DESCRIPTIONS[PEARL_ROUTINE_MODEL],
      model: PEARL_ROUTINE_MODEL,
      reasoning: "low",
      modelOptions: {
        providerOptions: {
          gateway: {
            ...PEARL_ROUTINE_GATEWAY_OPTIONS,
            tags: ["agent:pearl", "auto:mini"],
          },
        },
      },
    },
    "openai/gpt-6.1-sol": {
      description: PEARL_AUTO_OPTION_DESCRIPTIONS["openai/gpt-6.1-sol"],
      model: "openai/gpt-6.1-sol",
      reasoning: "low",
      modelOptions: {
        providerOptions: {
          gateway: {
            ...GATEWAY_PROVIDER_OPTIONS,
            tags: ["agent:pearl", "auto:sol"],
          },
        },
      },
    },
    "paperinstruments/ultramarine-1-flash": {
      description:
        PEARL_AUTO_OPTION_DESCRIPTIONS["paperinstruments/ultramarine-1-flash"],
      model: "paperinstruments/ultramarine-1-flash",
      reasoning: "medium",
      // Ultramarine often lacks a catalog US zone pin; ZDR only.
      modelOptions: {
        providerOptions: {
          gateway: {
            ...GATEWAY_ZDR_PROVIDER_OPTIONS,
            tags: ["agent:pearl", "auto:ultramarine"],
          },
        },
      },
    },
  },
});

const evaluatePearlAuto = unwrapDynamic(pearlAutoModel);

export { classifyPearlHeuristic };

type HistoryMessage = {
  readonly role?: string;
  readonly content?: unknown;
  readonly kind?: unknown;
};

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type?: string }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      parts.push((part as { text: string }).text);
    }
  }
  return parts.join("\n");
}

function isClientContextMessage(message: HistoryMessage): boolean {
  if (message.role !== "user") return false;
  if (message.kind === "context.instruction") return true;
  if (message.kind !== undefined) return false;
  return messageText(message.content).startsWith("Client context:");
}

/** Latest real user text (skips ephemeral clientContext). */
export function latestUserText(
  messages: readonly HistoryMessage[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (isClientContextMessage(message)) continue;
    const text = messageText(message.content).trim();
    if (text) return text;
  }
  return "";
}

function gatewayPolicyForPinnedModel(model: string) {
  // Mini / Ultramarine lack a reliable US zone pin in the catalog.
  if (
    model === PEARL_ROUTINE_MODEL ||
    model.startsWith("paperinstruments/ultramarine")
  ) {
    return { ...PEARL_ROUTINE_GATEWAY_OPTIONS };
  }
  return { ...GATEWAY_PROVIDER_OPTIONS };
}

function pinnedSelection(model: string) {
  return selectionWithGateway(model, gatewayPolicyForPinnedModel(model));
}

/**
 * Resolve the parent-agent model for one call.
 * Precedence: AGENT_MODEL_OVERRIDE → pinned picker → eve `auto()`.
 */
export async function resolvePearlModel(ctx: DynamicModelContext) {
  const messages = (await ctx.messages()) as ScannedMessageLike;
  const history = messages as readonly HistoryMessage[];
  const seed = latestUserText(history);

  // Tool / waiting surfaces from heuristics only — not from which model auto picks.
  setPearlLane(classifyPearlHeuristic(seed));

  const override = process.env.AGENT_MODEL_OVERRIDE?.trim();
  if (override) {
    // Pinned experiment — expose every tool surface.
    setPearlLane(null);
    return pinnedSelection(override);
  }

  const pinned = readClientModelSelection(messages);
  if (pinned) {
    setPearlLane(null);
    return pinnedSelection(pinned);
  }

  return evaluatePearlAuto(ctx);
}

/**
 * Sync resolve for a pinned picker key or override (no Auto router).
 * Used by unit tests; production Auto path is async via resolvePearlModel.
 */
export function resolvePinnedModelForStep(messages: ScannedMessageLike) {
  const override = process.env.AGENT_MODEL_OVERRIDE?.trim();
  if (override) return pinnedSelection(override);
  const pinned = readClientModelSelection(messages);
  if (pinned) return pinnedSelection(pinned);
  // Missing / auto marker → Auto would route; tests that hit this expect Sol
  // as the DEFAULT_MODEL identity for subagents and the allowlist baseline.
  return pinnedSelection(DEFAULT_MODEL);
}
