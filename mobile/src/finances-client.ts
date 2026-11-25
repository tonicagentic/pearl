import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type MonthSpendCategory = {
  categoryId: string | null;
  groupId: string | null;
  name: string;
  groupName: string;
  amount: number;
};

export type MonthSpendGroup = {
  groupId: string | null;
  name: string;
  amount: number;
};

export type MonthSpendSummary = {
  year: number;
  month: number;
  label: string;
  from: string;
  to: string;
  totalSpent: number;
  totalSpentLabel: string;
  groups: MonthSpendGroup[];
  categories: MonthSpendCategory[];
};

export type FinancesTransaction = {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  type: string;
  account?: { id: string; name: string; type: string } | null;
  category?: { id: string; name: string; slug: string } | null;
};

export type FinancesTransactionsPayload = {
  items: FinancesTransaction[];
  nextCursor: string | null;
  hasMore?: boolean;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  // 401 = credential rejected → clear session. 403 = signed in but not the
  // finance owner — keep the Pearl session; Finances just isn't available.
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to view finances.");
  }
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (response.status === 403) {
    throw new Error(
      json?.error ?? "Finances isn’t available for this account.",
    );
  }
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed (${response.status})`);
  }
  return json as T;
}

export async function fetchMonthSpendSummary(input: {
  year: number;
  month: number;
}): Promise<MonthSpendSummary> {
  const params = new URLSearchParams({
    year: String(input.year),
    month: String(input.month),
  });
  const response = await fetch(
    `${AGENT_URL}/api/v1/finances/spend-summary?${params}`,
    { headers: authHeaders() },
  );
  return readJson<MonthSpendSummary>(response);
}

export async function fetchFinancesTransactions(
  params: URLSearchParams,
): Promise<FinancesTransactionsPayload> {
  const response = await fetch(
    `${AGENT_URL}/api/v1/finances/transactions?${params.toString()}`,
    { headers: authHeaders() },
  );
  const payload = await readJson<{
    items?: Array<{
      id: string;
      date: string;
      memo: string | null;
      amount: number | string;
      type: string;
      account?: { id: string; name: string; type: string } | null;
      category?: { id: string; name: string; slug: string } | null;
    }>;
    nextCursor?: string | null;
    hasMore?: boolean;
  }>(response);

  return {
    items: (payload.items ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      memo: row.memo,
      amount: Number(row.amount),
      type: row.type,
      account: row.account ?? null,
      category: row.category ?? null,
    })),
    nextCursor: payload.nextCursor ?? null,
    hasMore: payload.hasMore,
  };
}
