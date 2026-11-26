import type { SessionStore } from "eve/client";
import { errorSummary } from "../agent-debug-log";

const DEFAULT_BACKOFF_MS = [250, 750, 1_500] as const;

export type ReconnectResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Reattach an eve SessionStore to its remote session.
 * Resumes with backoff. Never cancels: cancel aborts the live turn, and
 * when no turn is active yet it waits and aborts the next one. Production
 * threads then settle as cancelled and later messages are ignored.
 * Does not call newSession — that is recoverDeadSession's job.
 * Does not call cancel() — that would abort a live turn. After followWhile
 * closes the root stream, resume() reopens observation from the cursor;
 * Delivery tracking for a just-accepted send remains on store.send / follow().
 */
export async function reconnectSession(
  store: SessionStore,
  options: {
    readonly offline?: boolean;
    readonly backoffMs?: readonly number[];
  } = {},
): Promise<ReconnectResult> {
  if (options.offline) {
    return { ok: false, error: "You're offline." };
  }
  if (!store.snapshot.session) {
    return { ok: true };
  }

  const delays = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (attempt > 0) {
      const wait = delays[attempt - 1] ?? delays[delays.length - 1]!;
      await sleep(wait);
    }

    try {
      await store.resume();
      return { ok: true };
    } catch (cause) {
      const message = errorSummary(cause) ?? "Could not reconnect.";
      // A send is already in flight. Cancelling it is what silenced long turns.
      if (message.includes("pending submissions")) {
        return { ok: true };
      }
      lastError = message;
    }
  }

  return {
    ok: false,
    error: lastError ?? "Could not reconnect to Pearl.",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
