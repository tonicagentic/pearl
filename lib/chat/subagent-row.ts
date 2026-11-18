/**
 * Flat in-transcript subagent row: truncated task title, model label, and the
 * child's current activity (timeline voice). Pure so web and mobile share it.
 */

import { runs, type SessionView } from "eve/events";

import { extractReasoningHeading } from "../stream-thinking-state.ts";
import {
  statusLabelForTool,
  type ActivityToolPart,
} from "../thread-activity.ts";

export const WAITING_FOR_SUBAGENT_LABEL = "Waiting for subagent";

const TITLE_MAX = 48;
const ACTIVITY_MAX = 72;
const MODEL_MAX = 28;

/**
 * Gateway model id → short display label. Keep in sync with composer /
 * coder tier ids; unknown ids fall back to the trailing segment.
 */
const MODEL_LABEL_BY_ID: Readonly<Record<string, string>> = {
  "openai/gpt-6.1-sol": "GPT 6.1 Sol",
  "zai/glm-5.3-flash": "GLM 5.3 Flash",
  "meta/muse-spark-open": "Muse Spark Open",
  "spacexai/grok-4.7": "Grok 4.7",
  "openai/gpt-6-astra": "GPT 6 Astra",
  "google/gemini-4-argon": "Gemini 4 Argon",
  "meta/muse-wonder-1.0": "Muse Wonder 1.0",
  "callstack/apex": "Apex",
};
export type SubagentRowMessagePart = {
  readonly type?: string;
  readonly text?: string;
  readonly name?: string;
  readonly toolName?: string;
  readonly label?: string;
  readonly args?: unknown;
  readonly argsText?: string;
  readonly input?: unknown;
  readonly inputText?: string;
  readonly state?: string;
  /** Eve tool parts use a string state; assistant-ui uses `{ type }`. */
  readonly status?: string | { readonly type?: string };
};

export type SubagentRowMessage = {
  readonly role?: string;
  readonly parts?: readonly SubagentRowMessagePart[];
  readonly metadata?: { readonly status?: string };
};

export type SubagentRowChild = {
  readonly name?: string;
  readonly observation?: {
    readonly status?: string;
    readonly conversation?: {
      readonly view?: SessionView;
      /** EveMessage[] or assistant-ui parts; narrowed when reading activity. */
      readonly messages?: readonly unknown[];
    };
  };
};

export type SubagentRowContent = {
  readonly title: string;
  readonly modelLabel?: string;
  readonly activity?: string;
};

function clip(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

/** First line of the delegation message, truncated for the row title. */
export function subagentRowTitle(
  message: string | undefined,
  fallback: string,
): string {
  const raw =
    typeof message === "string" ? message.split("\n")[0]?.trim() ?? "" : "";
  if (!raw) return fallback;
  return clip(raw, TITLE_MAX);
}

/** Human label for a gateway model id, or the id's trailing segment. */
export function modelLabelForId(modelId: string | undefined): string | undefined {
  if (!modelId?.trim()) return undefined;
  const known = MODEL_LABEL_BY_ID[modelId];
  if (known) return clip(known, MODEL_MAX);
  const slash = modelId.lastIndexOf("/");
  const bare = slash >= 0 ? modelId.slice(slash + 1) : modelId;
  if (!bare) return undefined;
  // gpt-6-astra → GPT 6 Astra-ish: keep as-is with light cleanup.
  const spaced = bare.replace(/[-_]+/g, " ").trim();
  return clip(spaced, MODEL_MAX);
}

function latestChildModelId(view: SessionView | undefined): string | undefined {
  if (!view) return undefined;
  const list = runs(view);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const modelId = list[i]?.modelId;
    if (modelId) return modelId;
  }
  return undefined;
}

function partStatusType(part: SubagentRowMessagePart): string | undefined {
  if (typeof part.status === "string") return part.status;
  if (part.status && typeof part.status === "object") return part.status.type;
  return part.state;
}

function isLiveToolState(state: string | undefined): boolean {
  if (!state) return true;
  return (
    state === "running" ||
    state === "streaming" ||
    state === "requested" ||
    state === "input-streaming" ||
    state === "input-available"
  );
}

function asActivityTool(
  part: SubagentRowMessagePart,
): ActivityToolPart | undefined {
  const toolName = part.toolName ?? part.name;
  if (!toolName) return undefined;
  const args = part.args ?? part.input;
  const argsText =
    part.argsText ??
    (typeof part.inputText === "string" ? part.inputText : undefined);
  return {
    type: "tool-call",
    toolName,
    args,
    argsText,
    label: typeof part.label === "string" ? part.label : undefined,
    status: {
      type: isLiveToolState(partStatusType(part)) ? "running" : "complete",
    },
  };
}

function isToolPart(part: SubagentRowMessagePart): boolean {
  return part.type === "tool" || part.type === "tool-call";
}

/**
 * One short activity line from the followed child: prefer an in-flight tool
 * label (timeline voice), then a reasoning heading. Omits when nothing useful.
 */
function asRowMessages(
  messages: readonly unknown[] | undefined,
): readonly SubagentRowMessage[] {
  if (!messages?.length) return [];
  return messages as readonly SubagentRowMessage[];
}

export function subagentRowActivity(
  messages: readonly unknown[] | undefined,
): string | undefined {
  const rows = asRowMessages(messages);
  if (!rows.length) return undefined;
  const lastAssistant = [...rows]
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistant?.parts?.length) return undefined;

  const parts = lastAssistant.parts;

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (!part || !isToolPart(part)) continue;
    if (!isLiveToolState(partStatusType(part))) continue;
    if ((part.name ?? part.toolName) === "todo") continue;
    if ((part.name ?? part.toolName) === "write_file") continue;
    const tool = asActivityTool(part);
    if (!tool) continue;
    const label = statusLabelForTool(tool, { live: true }).trim();
    if (label) return clip(label, ACTIVITY_MAX);
  }

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part?.type !== "reasoning") continue;
    const state = partStatusType(part);
    if (state && state !== "streaming" && state !== "running") continue;
    const heading = extractReasoningHeading(part.text, { maxLen: ACTIVITY_MAX });
    if (heading) return heading;
  }

  return undefined;
}

/** Assemble the flat row fields for a live or settled delegation. */
export function deriveSubagentRowContent(input: {
  readonly title: string;
  readonly child?: SubagentRowChild | undefined;
}): SubagentRowContent {
  const { title, child } = input;
  const observation = child?.observation;
  if (!observation || observation.status === "not-followed") {
    return { title };
  }
  const conversation = observation.conversation;
  const modelLabel = modelLabelForId(
    latestChildModelId(conversation?.view),
  );
  const activity = subagentRowActivity(conversation?.messages);
  return {
    title,
    ...(modelLabel ? { modelLabel } : {}),
    ...(activity ? { activity } : {}),
  };
}
