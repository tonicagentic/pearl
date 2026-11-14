// Gmail mailbox client for the mobile app. Hits /api/mailboxes with the
// same better-auth credential the eve transport uses.

import type { MailboxClientSummary } from "../../lib/mail/types";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type { MailboxClientSummary };

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
  throw new Error(`${fallback} (${response.status}).`);
}

export async function listMailboxes(): Promise<MailboxClientSummary[]> {
  const response = await fetch(`${AGENT_URL}/api/mailboxes`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load mailboxes");
  }
  const data = (await response.json()) as {
    mailboxes: MailboxClientSummary[];
  };
  return data.mailboxes;
}

export async function authorizeMailbox(
  mailboxId?: string,
): Promise<{ mailboxId: string; url: string; userCode?: string }> {
  const response = await fetch(`${AGENT_URL}/api/mailboxes/authorize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      deviceCode: true,
      ...(mailboxId ? { mailboxId } : {}),
    }),
  });
  if (!response.ok) {
    await parseError(response, "Could not start authorization");
  }
  return (await response.json()) as {
    mailboxId: string;
    url: string;
    userCode?: string;
  };
}

export async function revokeMailbox(
  mailboxId: string,
): Promise<MailboxClientSummary[]> {
  const response = await fetch(`${AGENT_URL}/api/mailboxes/revoke`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mailboxId }),
  });
  if (!response.ok) {
    await parseError(response, "Could not disconnect mailbox");
  }
  const data = (await response.json()) as {
    mailboxes: MailboxClientSummary[];
  };
  return data.mailboxes;
}
