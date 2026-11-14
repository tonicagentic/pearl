// iCloud Calendar account client for the mobile app. Hits
// /api/calendar-accounts with the same better-auth credential the eve
// transport uses.

import type { IcloudCalendarAccountSummary } from "../../lib/calendar/types";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type { IcloudCalendarAccountSummary };

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  let message = `${fallback} (${response.status}).`;
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) {
      message = data.error.trim();
    }
  } catch {
    // Keep status fallback.
  }
  throw new Error(message);
}

export async function listCalendarAccounts(): Promise<{
  accounts: IcloudCalendarAccountSummary[];
  available: boolean;
}> {
  const response = await fetch(`${AGENT_URL}/api/calendar-accounts`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load calendar accounts");
  }
  return (await response.json()) as {
    accounts: IcloudCalendarAccountSummary[];
    available: boolean;
  };
}

export async function createCalendarAccount(params: {
  readonly appleId: string;
  readonly appSpecificPassword: string;
  readonly nickname?: string;
}): Promise<{
  account: IcloudCalendarAccountSummary;
  accounts: IcloudCalendarAccountSummary[];
}> {
  const response = await fetch(`${AGENT_URL}/api/calendar-accounts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    await parseError(response, "Could not link iCloud Calendar");
  }
  return (await response.json()) as {
    account: IcloudCalendarAccountSummary;
    accounts: IcloudCalendarAccountSummary[];
  };
}

export async function revokeCalendarAccount(
  accountId: string,
): Promise<IcloudCalendarAccountSummary[]> {
  const response = await fetch(`${AGENT_URL}/api/calendar-accounts/revoke`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ accountId }),
  });
  if (!response.ok) {
    await parseError(response, "Could not disconnect calendar account");
  }
  const data = (await response.json()) as {
    accounts: IcloudCalendarAccountSummary[];
  };
  return data.accounts;
}
