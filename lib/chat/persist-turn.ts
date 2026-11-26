import type { ClientSessionState, SessionStreamEvent } from "eve/client";

import {
  mergeEventsForSnapshot,
  sessionEventsEqual,
} from "./eve-session-recovery.ts";

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) chunks.push(text);
  }
  return chunks.join("\n").trim();
}

/** First user message text from durable `delivery.consumed` events, if any. */
function firstUserTextFromEvents(
  events: readonly SessionStreamEvent[],
): string | null {
  for (const event of events) {
    if (event.type !== "delivery.consumed") continue;
    const data = (event as { data?: { parts?: unknown } }).data;
    const text = textFromParts(data?.parts);
    if (text) return text;
  }
  return null;
}

export type PersistAppendEntry = {
  readonly event: SessionStreamEvent;
  readonly eventIndex: number;
};

export type PersistTurnPlan =
  | { readonly kind: "noop" }
  | {
      readonly kind: "append";
      readonly events: readonly PersistAppendEntry[];
      readonly session: ClientSessionState | undefined;
      readonly firstUserText: string | null;
      readonly savedEventCount: number;
      readonly confirmedNextIndex: number;
    }
  | {
      readonly kind: "snapshot";
      readonly events: readonly SessionStreamEvent[];
      readonly session: ClientSessionState | undefined;
      readonly firstUserText: string | null;
      readonly savedEventCount: number;
      readonly confirmedNextIndex: number;
    };

/**
 * True when `live` still starts with `archived` (same session, growing log).
 */
export function isLivePrefixExtension(
  archived: readonly SessionStreamEvent[],
  live: readonly SessionStreamEvent[],
): boolean {
  if (archived.length === 0) return true;
  if (live.length < archived.length) return false;
  for (let i = 0; i < archived.length; i += 1) {
    if (!sessionEventsEqual(live[i]!, archived[i]!)) return false;
  }
  return true;
}

/**
 * Decide how to persist a settled turn.
 *
 * Ordinary growth is append-only. A full snapshot is only for a real prefix
 * change when this device holds the full prefix (`hydratedFromIndex === 0`).
 */
export function planTurnPersist(input: {
  readonly archived: readonly SessionStreamEvent[];
  readonly live: readonly SessionStreamEvent[];
  readonly hydratedFromIndex: number;
  readonly confirmedNextIndex: number;
  readonly savedEventCount: number;
  readonly session: ClientSessionState | undefined;
}): PersistTurnPlan {
  if (input.live.length === 0) {
    return { kind: "noop" };
  }

  const merged = mergeEventsForSnapshot(input.archived, input.live);
  if (merged.length === input.savedEventCount) {
    return { kind: "noop" };
  }

  const firstUserText = firstUserTextFromEvents(merged);
  const extension = isLivePrefixExtension(input.archived, input.live);

  if (extension || input.hydratedFromIndex > 0) {
    // Extension: append anything past the last confirmed absolute index.
    // Truncated hydrate + prefix change: still append-only — never rewrite
    // rows this device never loaded.
    const source = extension ? merged : input.live;
    const localStart = extension
      ? Math.max(0, input.confirmedNextIndex - input.hydratedFromIndex)
      : 0;
    const absoluteStart = extension
      ? input.hydratedFromIndex + localStart
      : input.confirmedNextIndex;
    const tail = source.slice(localStart);
    const events = tail.map((event, offset) => ({
      event,
      eventIndex: absoluteStart + offset,
    }));
    const confirmedNextIndex =
      events.length > 0
        ? events[events.length - 1]!.eventIndex + 1
        : input.confirmedNextIndex;
    return {
      kind: "append",
      events,
      session: input.session,
      firstUserText,
      savedEventCount: merged.length,
      confirmedNextIndex,
    };
  }

  return {
    kind: "snapshot",
    events: merged,
    session: input.session,
    firstUserText,
    savedEventCount: merged.length,
    confirmedNextIndex: merged.length,
  };
}

export type { ClientSessionState };
