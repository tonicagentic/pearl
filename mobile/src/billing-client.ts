import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type MobileBillingStatus = {
  readonly enabled: boolean;
  readonly allowed: boolean;
  readonly exempt: boolean;
  readonly trial: boolean;
  readonly guest?: boolean;
  readonly needsCheckout: boolean;
  readonly needsSignup?: boolean;
  readonly reason: string | null;
  readonly message: string | null;
  readonly usageCapCents: number | null;
  readonly spentCents: number;
  readonly remainingCents: number | null;
  readonly guestMessageCount?: number;
  readonly guestMessageLimit?: number;
  readonly hasPortal: boolean;
  readonly periodStart?: string | null;
  readonly periodEnd?: string | null;
  readonly bySource: readonly {
    readonly source: string;
    readonly costCents: number;
  }[];
};

function authHeaders(): HeadersInit {
  const token = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchBillingStatus(): Promise<MobileBillingStatus | null> {
  const response = await fetch(`${AGENT_URL}/api/billing/status`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as MobileBillingStatus;
}

export async function startBillingCheckout(): Promise<string> {
  const response = await fetch(`${AGENT_URL}/api/billing/checkout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      successPath: "/billing/success",
      cancelPath: "/billing",
    }),
  });
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) {
    throw new Error(body.error ?? "Could not start checkout.");
  }
  return body.url;
}

export async function startBillingPortal(): Promise<string> {
  const response = await fetch(`${AGENT_URL}/api/billing/portal`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !body.url) {
    throw new Error(body.error ?? "Could not open billing portal.");
  }
  return body.url;
}

export async function updateUsageCap(usageCapCents: number): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/billing/cap`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ usageCapCents }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "Could not update spend cap.");
  }
}
