/**
 * Catch-up policy for returning to a thread.
 *
 * While the store is `resuming`, text content.deltas are held off the live
 * word pacer. When resume settles, either drop the hold (idle / waiting —
 * the snapshot already has the message) or seed the live overlay and snap
 * the reveal so only post-catch-up tokens are paced.
 *
 * call.input / call.progress still fold into the store during resume, but
 * thinking chrome must stay quiet — see shouldSuppressLiveChrome.
 */

import {
  isCatchUpChromeProgress,
  shouldClearCatchUpOnEvent,
} from "./stream-event-contract";

export type SessionStatus = "idle" | "busy" | "resuming";

export { shouldClearCatchUpOnEvent, isCatchUpChromeProgress };

/** True while resume is catching up — suppress thinking / timeline flashes. */
export function shouldSuppressLiveChrome(status: SessionStatus): boolean {
  return status === "resuming";
}

export type HeldDelta = {
  readonly turnId?: string;
  readonly partId: string;
  readonly kind?: string;
  readonly delta: string;
};

export type CatchUpDeltaAction =
  | { readonly kind: "push" }
  | { readonly kind: "hold" }
  | { readonly kind: "ignore" };

/** Route a content.delta during or after catch-up. */
export function routeCatchUpDelta(input: {
  readonly status: SessionStatus;
  readonly kind?: string;
}): CatchUpDeltaAction {
  // Reasoning and other non-text kinds never enter the live reply buffer.
  if (input.kind && input.kind !== "text") return { kind: "ignore" };
  if (input.status === "resuming") return { kind: "hold" };
  return { kind: "push" };
}

export type CatchUpFlushAction =
  | { readonly kind: "drop" }
  | { readonly kind: "seed"; readonly held: readonly HeldDelta[] }
  | { readonly kind: "noop" };

/**
 * Decide what to do with held deltas once resume() resolves.
 * Empty hold → noop (warm thread already on screen; do not snap the pacer).
 */
export function flushCatchUpHold(input: {
  readonly status: SessionStatus;
  readonly held: readonly HeldDelta[];
}): CatchUpFlushAction {
  if (input.held.length === 0) return { kind: "noop" };
  // Still generating: seed the overlay so the backlog paints at once.
  if (input.status === "busy") {
    return { kind: "seed", held: input.held };
  }
  // Idle or waiting: the settled snapshot (or question) is the paint.
  return { kind: "drop" };
}

/** Keep a background stream observer only while a turn or pending send is live. */
export function shouldKeepBackgroundSubscription(input: {
  readonly status: SessionStatus;
  readonly pendingMessage: boolean;
}): boolean {
  return input.status === "busy" || input.pendingMessage;
}

/**
 * Keep an unsent draft only when history has not yet seen delivery.consumed.
 * A consumed send must not be retried into history.
 */
export function shouldKeepPendingDraft(input: {
  readonly pendingMessage: string | null | undefined;
  readonly hasHistory: boolean;
  readonly hasConsumed: boolean;
}): string | null {
  if (!input.pendingMessage) return null;
  if (!input.hasHistory || !input.hasConsumed) return input.pendingMessage;
  return null;
}

/** Fold held deltas into partId → text for seeding the live overlay. */
export function collapseHeldDeltas(
  held: readonly HeldDelta[],
): {
  readonly turnId: string | null;
  readonly parts: readonly { readonly id: string; readonly text: string }[];
} {
  const order: string[] = [];
  const texts = new Map<string, string>();
  let turnId: string | null = null;
  const nonText = new Set<string>();
  for (const item of held) {
    if (item.partId && item.kind && item.kind !== "text") {
      nonText.add(item.partId);
    }
  }
  for (const item of held) {
    if (item.kind && item.kind !== "text") continue;
    if (!item.partId || item.delta.length === 0) continue;
    if (nonText.has(item.partId)) continue;
    if (item.turnId) turnId = item.turnId;
    if (!texts.has(item.partId)) order.push(item.partId);
    texts.set(item.partId, (texts.get(item.partId) ?? "") + item.delta);
  }
  return {
    turnId,
    parts: order.map((id) => ({ id, text: texts.get(id)! })),
  };
}
