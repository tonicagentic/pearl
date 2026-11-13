import { defineState } from "eve/context";

import type { PearlLane } from "@/lib/pearl-lane";

/**
 * Lane chosen by the parent model router for this model call.
 * Model selection runs before tools (eve docs: dynamic-configuration
 * execution order), so tools read this for prefill gating.
 *
 * null = Auto was not used (pinned model / override) → expose all surfaces.
 */
export const pearlLaneState = defineState(
  "pearl.lane",
  (): PearlLane | null => null,
);

export function setPearlLane(lane: PearlLane | null): void {
  pearlLaneState.update(() => lane);
}

export function currentPearlLane(): PearlLane | null {
  return pearlLaneState.get();
}

export function toolSurfaceEnabled(): boolean {
  const lane = currentPearlLane();
  return lane === null || lane === "tools";
}

export function analysisSurfaceEnabled(): boolean {
  const lane = currentPearlLane();
  return lane === null || lane === "analysis";
}

export function imageSurfaceEnabled(turnHint?: string): boolean {
  const lane = currentPearlLane();
  if (lane === null) return true;
  if (
    turnHint &&
    /\b(image|illustration|logo|svg|icon|poster|graphic)\b/i.test(turnHint)
  ) {
    return true;
  }
  // Keep image tools off voice/think/tools/analysis unless the turn asks.
  return false;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && "text" in part
        ? String((part as { text?: unknown }).text ?? "")
        : typeof part === "string"
          ? part
          : "",
    )
    .join("\n");
}

/** Latest user text for image-tool gating inside defineDynamic. */
export function latestUserHint(
  messages: readonly { readonly role?: string; readonly content?: unknown }[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = contentText(message.content).trim();
    if (text && !text.startsWith("Client context:")) return text;
  }
  return "";
}
