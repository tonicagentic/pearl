import type { SessionStore } from "eve/client";
import { isEveSessionInactive } from "../../lib/chat/eve-session-recovery";
import { reconnectSession } from "./session-reconnect";
import { shouldRestoreUnsentDraft } from "./send-feedback";

const SEND_BACKOFF_MS = [300, 800, 1_600] as const;
const WAIT_CONSUMED_MS = 8_000;
const WAIT_POLL_MS = 200;

export type SendRetryContext = {
  readonly store: SessionStore;
  readonly wasSendPrepared: (source: SessionStore) => boolean;
  readonly recoverDeadSession: (source: SessionStore) => boolean;
  readonly clearSessionRecovery: (source: SessionStore) => void;
  readonly clearPendingMessage: (source: SessionStore) => void;
  readonly offline: boolean;
  readonly waitWhileOffline?: () => Promise<void>;
};

export type SendRetryResult =
  | { readonly outcome: "accepted"; readonly deliveryId?: string }
  | { readonly outcome: "failed"; readonly message: string; readonly uncertain: boolean };

function isRetryableClientError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const code = (error as { readonly code?: unknown }).code;
    const retryable = (error as { readonly retryable?: unknown }).retryable;
    if (code === "session_not_ready" || retryable === true) return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("failed to fetch")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDeliveryConsumed(
  store: SessionStore,
  eventBaseline: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const accepted = store.snapshot.events
      .slice(eventBaseline)
      .some((event) => event.type === "delivery.consumed");
    if (accepted) return true;
    await sleep(WAIT_POLL_MS);
  }
  return store.snapshot.events
    .slice(eventBaseline)
    .some((event) => event.type === "delivery.consumed");
}

/**
 * Quiet send ladder: retry when nothing left the device; reconnect and wait
 * when delivery may already be accepted; one newSession for inactive sessions.
 */
export async function sendWithRetry(
  ctx: SendRetryContext,
  payload: Parameters<SessionStore["send"]>[0],
  options: { readonly eventBaseline: number } = { eventBaseline: 0 },
): Promise<SendRetryResult> {
  const { store } = ctx;
  let attempt = 0;
  let recovered = false;

  while (attempt <= SEND_BACKOFF_MS.length) {
    if (ctx.offline) {
      await ctx.waitWhileOffline?.();
    }

    if (attempt > 0) {
      await sleep(SEND_BACKOFF_MS[attempt - 1] ?? SEND_BACKOFF_MS.at(-1)!);
    }

    try {
      const delivery = await store.send(payload);

      if (
        shouldRestoreUnsentDraft(
          store.snapshot.error,
          ctx.wasSendPrepared(store),
        )
      ) {
        attempt += 1;
        continue;
      }

      if (
        isEveSessionInactive(store.snapshot.error) &&
        !recovered &&
        ctx.recoverDeadSession(store)
      ) {
        recovered = true;
        attempt += 1;
        continue;
      }

      const deliveryId =
        typeof delivery?.deliveryId === "string"
          ? delivery.deliveryId
          : undefined;

      if (deliveryId) {
        ctx.clearPendingMessage(store);
        const consumed = await waitForDeliveryConsumed(
          store,
          options.eventBaseline,
          WAIT_CONSUMED_MS,
        );
        if (!consumed) {
          await reconnectSession(store, { offline: ctx.offline });
          const afterResume = await waitForDeliveryConsumed(
            store,
            options.eventBaseline,
            WAIT_CONSUMED_MS,
          );
          if (!afterResume) {
            return {
              outcome: "failed",
              uncertain: true,
              message:
                "Couldn't confirm delivery. Your message is still here.",
            };
          }
        }
        ctx.clearSessionRecovery(store);
        return { outcome: "accepted", deliveryId };
      }

      // No deliveryId — may still have been accepted; reconnect and wait.
      await reconnectSession(store, { offline: ctx.offline });
      const consumed = await waitForDeliveryConsumed(
        store,
        options.eventBaseline,
        WAIT_CONSUMED_MS,
      );
      if (consumed) {
        ctx.clearPendingMessage(store);
        ctx.clearSessionRecovery(store);
        return { outcome: "accepted" };
      }

      if (!ctx.wasSendPrepared(store) || isRetryableClientError(store.snapshot.error)) {
        attempt += 1;
        continue;
      }

      return {
        outcome: "failed",
        uncertain: true,
        message: "Couldn't confirm delivery. Your message is still here.",
      };
    } catch (cause) {
      if (
        (isEveSessionInactive(cause) ||
          isEveSessionInactive(store.snapshot.error)) &&
        !recovered &&
        ctx.recoverDeadSession(store)
      ) {
        recovered = true;
        attempt += 1;
        continue;
      }

      if (!ctx.wasSendPrepared(store) || isRetryableClientError(cause)) {
        attempt += 1;
        continue;
      }

      return {
        outcome: "failed",
        uncertain: true,
        message:
          cause instanceof Error
            ? cause.message
            : "Couldn't reach Pearl. Your message is still here.",
      };
    }
  }

  return {
    outcome: "failed",
    uncertain: !ctx.wasSendPrepared(store) ? false : true,
    message: "Couldn't reach Pearl. Your message is still here.",
  };
}
