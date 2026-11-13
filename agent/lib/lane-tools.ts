import type { PearlLane } from "@/lib/pearl-lane";
import {
  classifyPearlHeuristic,
  laneNeedsAnalysisSurface,
  laneNeedsImageSurface,
  laneNeedsToolSurface,
} from "@/lib/pearl-lane";

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
    if (
      part &&
      typeof part === "object" &&
      typeof (part as { text?: unknown }).text === "string"
    ) {
      parts.push((part as { text: string }).text);
    } else if (typeof part === "string") {
      parts.push(part);
    }
  }
  return parts.join("\n");
}

function isClientContext(message: HistoryMessage): boolean {
  if (message.role !== "user") return false;
  if (message.kind === "context.instruction") return true;
  if (message.kind !== undefined) return false;
  return messageText(message.content).startsWith("Client context:");
}

export function latestUserTextFromMessages(
  messages: readonly HistoryMessage[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (isClientContext(message)) continue;
    const text = messageText(message.content).trim();
    if (text) return text;
  }
  return "";
}

/** Heuristic lane for tool prefill (no Decider — free and sync). */
export function heuristicLaneForMessages(
  messages: readonly HistoryMessage[],
): PearlLane | null {
  return classifyPearlHeuristic(latestUserTextFromMessages(messages));
}

export function shouldExposeToolSurface(
  messages: readonly HistoryMessage[],
): boolean {
  return laneNeedsToolSurface(heuristicLaneForMessages(messages));
}

export function shouldExposeAnalysisSurface(
  messages: readonly HistoryMessage[],
): boolean {
  return laneNeedsAnalysisSurface(heuristicLaneForMessages(messages));
}

export function shouldExposeImageSurface(
  messages: readonly HistoryMessage[],
): boolean {
  const text = latestUserTextFromMessages(messages);
  return laneNeedsImageSurface(heuristicLaneForMessages(messages), text);
}
