import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type UsageSourceRow = {
  readonly source: string;
  readonly costCents: number;
};

export type UsagePeriodRow = {
  readonly periodStart: string;
  readonly totalCents: number;
  readonly bySource: readonly UsageSourceRow[];
};

export type MobileUsageSummary = {
  readonly totalCents: number;
  readonly periods: readonly UsagePeriodRow[];
};

function authHeaders(): HeadersInit {
  const token = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export function formatSpendCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Total spend and per-period breakdown for the signed-in account. */
export async function fetchUsageSummary(): Promise<MobileUsageSummary | null> {
  const response = await fetch(`${AGENT_URL}/api/usage`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as MobileUsageSummary;
}
