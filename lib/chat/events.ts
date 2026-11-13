import type { SessionStreamEvent } from "eve/client";

export type ChatPresence = "working" | "waiting" | "unread" | "idle";

/** Dropped streams older than this are not shown as working. */
export const CHAT_WORKING_STALE_MS = 15 * 60 * 1000;

export function isChatTurnSettledEvent(event: SessionStreamEvent) {
  return (
    event.type === "turn.paused" ||
    event.type === "turn.settled" ||
    event.type === "session.ended"
  );
}

function pendingUserInputState(events: readonly SessionStreamEvent[]): {
  pendingInput: Set<string>;
  pendingAuth: Set<string>;
} {
  const pendingInput = new Set<string>();
  const pendingAuth = new Set<string>();

  for (const event of events) {
    if (event.type === "interaction.opened") {
      const { interactionId, request } = event.data;
      if (request.kind === "sign-in") {
        pendingAuth.add(interactionId);
      } else {
        pendingInput.add(interactionId);
      }
      continue;
    }

    if (event.type === "interaction.settled") {
      pendingInput.delete(event.data.interactionId);
      pendingAuth.delete(event.data.interactionId);
      continue;
    }

    if (event.type === "turn.settled" || event.type === "session.ended") {
      pendingInput.clear();
      pendingAuth.clear();
    }
  }

  return { pendingInput, pendingAuth };
}

/**
 * True when the chat is parked on the user: an unresolved tool approval,
 * question, or budget prompt, or an open sign-in challenge. Matches the
 * composer WaitingActionCard / sidebar "needs you" signal so history rows
 * stay in sync without reopening the chat.
 */
export function chatNeedsUserInput(
  events: readonly SessionStreamEvent[],
): boolean {
  const { pendingInput, pendingAuth } = pendingUserInputState(events);
  return pendingInput.size > 0 || pendingAuth.size > 0;
}

/**
 * True only for an open sign-in challenge. Used by the composer text-only
 * WaitingActionCard so a stale approval (tool already cancelled in the
 * thread) does not leave a buttonless "paused" banner after deny/cancel.
 */
export function chatNeedsAuthorization(
  events: readonly SessionStreamEvent[],
): boolean {
  return pendingUserInputState(events).pendingAuth.size > 0;
}

function eventTimeMs(
  event: SessionStreamEvent,
  fallback?: Date | string | number | null,
): number | null {
  const metaAt = (event as { meta?: { at?: unknown } }).meta?.at;
  if (typeof metaAt === "string") {
    const parsed = Date.parse(metaAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (fallback instanceof Date) {
    const ms = fallback.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback;
  }
  if (typeof fallback === "string") {
    const parsed = Date.parse(fallback);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readAtMs(lastReadAt: Date | string | null | undefined): number | null {
  if (lastReadAt == null) return null;
  if (lastReadAt instanceof Date) {
    const ms = lastReadAt.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(lastReadAt);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Home-list presence for one chat from its durable event log.
 * Priority: waiting → working → unread → idle.
 */
export function chatPresence(
  events: readonly SessionStreamEvent[],
  options: {
    readonly lastReadAt?: Date | string | null;
    readonly now?: number;
    /** Parallel created_at values when event.meta.at is missing. */
    readonly eventTimes?: readonly (Date | string | number | null | undefined)[];
  } = {},
): ChatPresence {
  const now = options.now ?? Date.now();
  const lastRead = readAtMs(options.lastReadAt);

  if (chatNeedsUserInput(events)) {
    return "waiting";
  }

  let lastSettleIndex = -1;
  let lastSettleMs: number | null = null;
  let openTurn = false;
  let openTurnLatestMs: number | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    const at = eventTimeMs(event, options.eventTimes?.[index]);

    if (isChatTurnSettledEvent(event)) {
      lastSettleIndex = index;
      if (at != null) lastSettleMs = at;
      openTurn = false;
      openTurnLatestMs = null;
      continue;
    }

    if (event.type === "turn.started" || event.type === "delivery.consumed") {
      if (index > lastSettleIndex) {
        openTurn = true;
        if (at != null) {
          openTurnLatestMs =
            openTurnLatestMs == null ? at : Math.max(openTurnLatestMs, at);
        }
      }
      continue;
    }

    if (openTurn && at != null) {
      openTurnLatestMs =
        openTurnLatestMs == null ? at : Math.max(openTurnLatestMs, at);
    }
  }

  if (openTurn) {
    const fresh =
      openTurnLatestMs == null ||
      now - openTurnLatestMs <= CHAT_WORKING_STALE_MS;
    if (fresh) return "working";
  }

  if (
    lastSettleMs != null &&
    (lastRead == null || lastSettleMs > lastRead)
  ) {
    return "unread";
  }

  return "idle";
}
