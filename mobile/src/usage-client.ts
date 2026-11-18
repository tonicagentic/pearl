import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type UsageSourceSubgroup = {
  readonly label: string;
  readonly costUsd: number;
  readonly costCents: number;
  readonly eventCount: number;
  readonly unitUsd: number | null;
  readonly rateLabel: string;
};

export type UsageSourceRow = {
  readonly source: string;
  readonly label: string;
  readonly provider: string;
  readonly pricingNote: string;
  readonly costUsd: number;
  readonly costCents: number;
  readonly eventCount: number;
  readonly unitUsd: number | null;
  readonly rateLabel: string;
  readonly subgroups: readonly UsageSourceSubgroup[];
};

export type UsagePeriodOption = {
  readonly periodStart: string;
  readonly periodEnd: string | null;
  readonly totalCents: number;
};

export type UsageTotalsPayload = {
  readonly modelCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly costUsd: number | null;
};

export type UsageBreakdownRow = UsageTotalsPayload & {
  readonly label: string;
};

export type UsageDayRow = UsageTotalsPayload & {
  readonly day: string;
};

export type UsageFilterPayload = {
  readonly preset: string;
  readonly periodStart: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly label: string;
};

export type MobileUsageSummary = {
  readonly filter: UsageFilterPayload;
  readonly currentPeriod: {
    readonly start: string;
    readonly end: string;
  };
  readonly periods: readonly UsagePeriodOption[];
  readonly totalUsd: number;
  readonly totalCents: number;
  readonly bySource: readonly UsageSourceRow[];
  readonly ledger: {
    readonly totalUsd: number;
    readonly totalCents: number;
    readonly bySource: readonly UsageSourceRow[];
  };
  readonly models: {
    readonly totals: UsageTotalsPayload;
    readonly turns: number;
    readonly byDay: readonly UsageDayRow[];
    readonly byModel: readonly UsageBreakdownRow[];
  };
};

/** Query used by the Usage screen filter chips. */
export type UsageSummaryQuery = {
  readonly preset?: "cycle" | "7d" | "30d" | "all";
  readonly periodStart?: string;
  readonly from?: string;
  readonly to?: string;
};

function authHeaders(): HeadersInit {
  const token = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** Presentation helper — rounds for display only. */
export function formatSpendUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "—";
  if (usd === 0) return "$0.00";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  const fixed = usd.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

export function formatSpendCents(cents: number): string {
  return formatSpendUsd(cents / 100);
}

export function formatUsd(costUsd: number | null): string {
  if (costUsd === null) return "—";
  return formatSpendUsd(costUsd);
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1)}k`;
  }
  return String(count);
}

/** Total spend + model token breakdown for the signed-in account. */
export async function fetchUsageSummary(
  query: UsageSummaryQuery = {},
): Promise<MobileUsageSummary | null> {
  const params = new URLSearchParams();
  if (query.preset) params.set("preset", query.preset);
  if (query.periodStart) params.set("periodStart", query.periodStart);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`${AGENT_URL}/api/usage${suffix}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as MobileUsageSummary;
}
