import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type MobileBillingStatus = {
  readonly enabled: boolean;
  readonly allowed: boolean;
  readonly exempt: boolean;
  readonly needsCheckout: boolean;
  readonly message: string | null;
  readonly usageCapCents: number | null;
  readonly spentCents: number;
  readonly remainingCents: number | null;
  readonly hasPortal: boolean;
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
