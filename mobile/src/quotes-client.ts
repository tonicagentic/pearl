import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type QuoteDto = {
  readonly id: string;
  readonly text: string;
  readonly chatId: string | null;
  readonly chatTitle: string | null;
  readonly messageId: string | null;
  readonly createdAt: string;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

export async function listQuotes(): Promise<readonly QuoteDto[]> {
  const response = await fetch(`${AGENT_URL}/api/quotes`, {
    headers: authHeaders(),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to view your quotes.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Failed to load quotes.");
  }
  const data = (await response.json()) as {
    quotes?: readonly QuoteDto[];
  };
  return data.quotes ?? [];
}

export async function createQuote(input: {
  readonly text: string;
  readonly chatId?: string | null;
  readonly messageId?: string | null;
}): Promise<QuoteDto> {
  const response = await fetch(`${AGENT_URL}/api/quotes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to save quotes.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Failed to save quote.");
  }
  const data = (await response.json()) as { quote: QuoteDto };
  return data.quote;
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/quotes/${encodeURIComponent(quoteId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to delete quotes.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Failed to delete quote.");
  }
}
