import { defineState } from "eve/context";

import {
  MODE_MARKER,
  PROJECT_ID_MARKER,
  type AgentMode,
} from "@/lib/agent-mode-context";
import {
  DEFAULT_IMAGE_MODEL,
  resolveImageModelForTurn,
} from "../model-selection.ts";

export { MODE_MARKER, PROJECT_ID_MARKER, type AgentMode };

// Per-turn client intent: Agent vs Plan mode, and the project workspace the
// chat is attached to. The composer sends these as untrusted clientContext;
// resolvers and tools re-verify ownership before acting on a projectId.
// imageModelId is the allowlisted gateway id for generate_image.

export type TurnClientIntent = {
  readonly mode: AgentMode;
  readonly projectId: string | null;
  readonly imageModelId: string;
};

export const turnClientIntent = defineState(
  "pearl.turnClientIntent",
  (): TurnClientIntent => ({
    mode: "agent",
    projectId: null,
    imageModelId: DEFAULT_IMAGE_MODEL,
  }),
);

interface ScannedMessage {
  readonly role: string;
  readonly content: unknown;
  readonly kind?: unknown;
}

function messageText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
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
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      parts.push(part.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function isClientContextMessage(message: ScannedMessage): boolean {
  if (message.role !== "user") return false;
  // Prefer the framework kind when present. Some resolve snapshots expose
  // ModelMessage without kind; fall back to the "Client context:" prefix
  // eve uses when serializing object clientContext.
  if (message.kind === "context.instruction") return true;
  if (message.kind !== undefined) return false;
  const text = messageText(message.content);
  return text?.startsWith("Client context:") === true;
}

function readMarker(
  messages: readonly ScannedMessage[],
  marker: string,
): string | undefined {
  const markerPattern = new RegExp(`"${marker}"\\s*:\\s*"([^"]+)"`);
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!isClientContextMessage(message)) continue;
    const text = messageText(message.content);
    if (!text) continue;
    const match = text.match(markerPattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/** Parse mode + projectId + image model from ephemeral clientContext messages. */
export function readTurnClientIntent(
  messages: readonly ScannedMessage[],
): TurnClientIntent {
  const modeRaw = readMarker(messages, MODE_MARKER);
  const mode: AgentMode = modeRaw === "plan" ? "plan" : "agent";
  const projectId = readMarker(messages, PROJECT_ID_MARKER)?.trim() || null;
  const imageModelId = resolveImageModelForTurn(
    messages as Parameters<typeof resolveImageModelForTurn>[0],
  );
  return { mode, projectId, imageModelId };
}

/** Allowlisted gateway image-model id for the current turn. */
export function currentImageModelId(): string {
  return turnClientIntent.get().imageModelId || DEFAULT_IMAGE_MODEL;
}

export function syncTurnClientIntent(
  messages: readonly ScannedMessage[],
): TurnClientIntent {
  const intent = readTurnClientIntent(messages);
  turnClientIntent.update(() => intent);
  return intent;
}

export function isPlanMode(): boolean {
  return turnClientIntent.get().mode === "plan";
}

export function planModeBlocked(toolName: string): {
  readonly error: string;
} {
  return {
    error:
      `Plan mode cannot call ${toolName}. Write or update a plan with save_plan, ` +
      "or switch to Agent mode to carry the work out.",
  };
}
