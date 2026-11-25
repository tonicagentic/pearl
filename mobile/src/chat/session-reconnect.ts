import type { SessionStore } from "eve/client";

const DEFAULT_BACKOFF_MS = [250, 750, 1_500] as const;

export type ReconnectResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Reattach an eve SessionStore to its remote session.
 * Cancels a stuck busy stream once, then resumes with backoff.
 * Does not call newSession — that is recoverDeadSession's job.
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

    const status = store.snapshot.status;
    if (status === "busy" || status === "resuming") {
      try {
        await store.cancel();
      } catch {
        // Cancel may reject when the stream is already gone.
      }
    }

    try {
      await store.resume();
      return { ok: true };
    } catch (cause) {
      lastError =
        cause instanceof Error ? cause.message : "Could not reconnect.";
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
