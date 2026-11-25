/** Soft Transactions Refresh throttle — keeps view-time refresh within ~past day. */
export const PLAID_REFRESH_MAX_AGE_MS = 18 * 60 * 60 * 1000;

/** Treat ledger sync older than this as stale in UI copy. */
export const PLAID_SYNC_STALE_MS = 24 * 60 * 60 * 1000;

export type PlaidFeedFreshnessInput = {
  status: string;
  lastSyncedAt: Date | string | null;
  lastRefreshedAt?: Date | string | null;
  /** Fallback when lastSyncedAt is null (legacy rows). */
  updatedAt?: Date | string | null;
};

export type PlaidFeedsFreshness = {
  asOf: string | null;
  lastRefreshedAt: string | null;
  staleItemCount: number;
  needsReconnectCount: number;
  itemCount: number;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveItemSyncedAt(item: PlaidFeedFreshnessInput): Date | null {
  return toDate(item.lastSyncedAt) ?? toDate(item.updatedAt);
}

export function buildPlaidFeedsFreshness(
  items: PlaidFeedFreshnessInput[],
): PlaidFeedsFreshness {
  if (items.length === 0) {
    return {
      asOf: null,
      lastRefreshedAt: null,
      staleItemCount: 0,
      needsReconnectCount: 0,
      itemCount: 0,
    };
  }

  const now = Date.now();
  let oldestSync: Date | null = null;
  let newestRefresh: Date | null = null;
  let staleItemCount = 0;
  let needsReconnectCount = 0;

  for (const item of items) {
    if (item.status !== "active") {
      needsReconnectCount += 1;
    }
    const synced = resolveItemSyncedAt(item);
    if (synced) {
      if (!oldestSync || synced < oldestSync) oldestSync = synced;
      if (item.status === "active" && now - synced.getTime() > PLAID_SYNC_STALE_MS) {
        staleItemCount += 1;
      }
    } else if (item.status === "active") {
      staleItemCount += 1;
    }
    const refreshed = toDate(item.lastRefreshedAt);
    if (refreshed && (!newestRefresh || refreshed > newestRefresh)) {
      newestRefresh = refreshed;
    }
  }

  return {
    asOf: oldestSync?.toISOString() ?? null,
    lastRefreshedAt: newestRefresh?.toISOString() ?? null,
    staleItemCount,
    needsReconnectCount,
    itemCount: items.length,
  };
}

/** Relative label for the Transactions register (no "realtime" claims). */
export function formatPlaidFreshnessLabel(
  freshness: PlaidFeedsFreshness,
  opts?: { updating?: boolean; formatDistance: (date: Date) => string },
): string | null {
  if (freshness.itemCount === 0) return null;
  if (opts?.updating) return "Updating bank feeds…";

  const asOf = freshness.asOf ? new Date(freshness.asOf) : null;
  let base: string;
  if (!asOf) {
    base = "Bank data not synced yet";
  } else if (freshness.staleItemCount > 0) {
    base = `Bank data may be stale (as of ${opts?.formatDistance(asOf) ?? asOf.toISOString()})`;
  } else {
    const ageMs = Date.now() - asOf.getTime();
    if (ageMs < 60 * 60 * 1000) {
      base = `Bank data updated ${opts?.formatDistance(asOf) ?? "recently"}`;
    } else {
      base = `Bank data as of ${opts?.formatDistance(asOf) ?? asOf.toISOString()}`;
    }
  }

  if (freshness.needsReconnectCount > 0) {
    const n = freshness.needsReconnectCount;
    base += ` · ${n} bank${n === 1 ? "" : "s"} need reconnect`;
  }
  return base;
}

export function shouldRefreshPlaidItem(input: {
  status: string;
  lastRefreshedAt: Date | string | null;
  forceRefresh?: boolean;
  now?: Date;
}): boolean {
  if (input.status !== "active") return false;
  if (input.forceRefresh) return true;
  const last = toDate(input.lastRefreshedAt);
  if (!last) return true;
  const now = input.now ?? new Date();
  return now.getTime() - last.getTime() >= PLAID_REFRESH_MAX_AGE_MS;
}

export function plaidErrorCode(err: unknown): string {
  if (typeof err !== "object" || err === null) return "";
  const response = (err as { response?: { data?: { error_code?: string } } })
    .response;
  const code = response?.data?.error_code;
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** Errors where we skip Refresh and continue with sync-only. */
export function isSkippableRefreshError(err: unknown): boolean {
  const code = plaidErrorCode(err);
  const msg = (err instanceof Error ? err.message : String(err)).toUpperCase();
  const haystack = `${code} ${msg}`;
  return (
    haystack.includes("PRODUCTS_NOT_SUPPORTED") ||
    haystack.includes("PRODUCT_NOT_READY") ||
    haystack.includes("ADDITIONAL_CONSENT_REQUIRED") ||
    haystack.includes("INVALID_PRODUCT") ||
    haystack.includes("PRODUCT_NOT_ENABLED") ||
    haystack.includes("NOT_AUTHORIZED") ||
    haystack.includes("TRANSACTIONS_REFRESH")
  );
}
