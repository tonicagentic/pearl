const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_BACKOFF_MS = [300, 800, 1_600] as const;

export type PersistenceRetryOptions = {
  readonly backoffMs?: readonly number[];
  readonly isTransient?: (error: unknown) => boolean;
};

/** HTTP statuses that are safe to retry for chat persistence writes. */
export function isTransientPersistenceStatus(status: number): boolean {
  return TRANSIENT_STATUS.has(status);
}

/**
 * True for transport failures and retryable HTTP statuses.
 * Does not retry 400/401/403/404 — those need a different user action.
 */
export function isTransientPersistenceError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object" && error !== null) {
    const status = (error as { readonly status?: unknown }).status;
    if (typeof status === "number") {
      return isTransientPersistenceStatus(status);
    }
  }

  if (error instanceof TypeError) return true;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("failed to fetch") ||
      message.includes("network request failed") ||
      message.includes("timeout") ||
      message.includes("timed out")
    ) {
      return true;
    }
    const match = error.message.match(/\((\d{3})\)/);
    if (match) {
      return isTransientPersistenceStatus(Number(match[1]));
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a persistence write with short backoff on transient failures.
 * Non-transient errors fail immediately.
 */
export async function persistWithRetry<T>(
  work: () => Promise<T>,
  options: PersistenceRetryOptions = {},
): Promise<T> {
  const delays = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const isTransient = options.isTransient ?? isTransientPersistenceError;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= delays.length) {
    try {
      return await work();
    } catch (cause) {
      lastError = cause;
      if (!isTransient(cause) || attempt >= delays.length) {
        throw cause;
      }
      await sleep(delays[attempt] ?? delays.at(-1)!);
      attempt += 1;
    }
  }

  throw lastError;
}
