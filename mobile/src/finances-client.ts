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
  amountLabel?: string;
  type: string;
  pending?: boolean;
  reconciledAt?: string | null;
  status?: "pending" | "inbox" | "categorized" | "cleared";
  account?: { id: string; name: string; type: string } | null;
  category?: {
    id: string;
    name: string;
    slug?: string;
    code?: string | null;
    groupName?: string | null;
  } | null;
};

export type FinancesTransactionsPayload = {
  items: FinancesTransaction[];
  nextCursor: string | null;
  hasMore?: boolean;
  filterOptions?: {
    accounts: Array<{ id: string; name: string; type: string }>;
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      groupName: string;
    }>;
  };
};

export type FinanceAccount = {
  id: string;
  name: string;
  type: string;
  sourceLabel: string;
  balanceLabel: string;
  booksBalanceLabel: string;
  entityName: string;
  inboxCount: number;
  unclearedCount: number;
  needsReconcile: boolean;
  institutionName: string | null;
};

export type BankFeed = {
  id: string;
  institutionName: string;
  status: string;
  accountCount: number;
  lastSyncedAt: string | null;
};

export type FinanceEntity = {
  id: string;
  name: string;
  slug: string;
  taxClass: string;
};

export type CategoryGroup = {
  id: string;
  name: string;
  kind: string;
  slug: string;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    code: string | null;
    monthActualLabel: string;
  }>;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to view finances.");
  }
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
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
      amountLabel?: string;
      type: string;
      pending?: boolean;
      reconciledAt?: string | null;
      status?: FinancesTransaction["status"];
      account?: { id: string; name: string; type: string } | null;
      category?: {
        id: string;
        name: string;
        slug?: string;
        code?: string | null;
        groupName?: string | null;
      } | null;
    }>;
    nextCursor?: string | null;
    hasMore?: boolean;
    filterOptions?: FinancesTransactionsPayload["filterOptions"];
  }>(response);

  return {
    items: (payload.items ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      memo: row.memo,
      amount: Number(row.amount),
      amountLabel: row.amountLabel,
      type: row.type,
      pending: row.pending,
      reconciledAt: row.reconciledAt ?? null,
      status: row.status,
      account: row.account ?? null,
      category: row.category ?? null,
    })),
    nextCursor: payload.nextCursor ?? null,
    hasMore: payload.hasMore,
    filterOptions: payload.filterOptions,
  };
}

export async function patchFinanceTransaction(
  id: string,
  input: { categoryId?: string | null; reconcile?: boolean },
) {
  const response = await fetch(`${AGENT_URL}/api/v1/transactions/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{ item: FinancesTransaction }>(response);
}

export async function fetchFinanceAccounts() {
  const response = await fetch(`${AGENT_URL}/api/v1/accounts`, {
    headers: authHeaders(),
  });
  return readJson<{ accounts: FinanceAccount[]; feeds: BankFeed[] }>(response);
}

export async function fetchFinanceEntities() {
  const response = await fetch(`${AGENT_URL}/api/v1/entities`, {
    headers: authHeaders(),
  });
  return readJson<{ youId: string | null; entities: FinanceEntity[] }>(
    response,
  );
}

export async function createFinanceEntity(input: {
  name: string;
  taxClass: string;
}) {
  const response = await fetch(`${AGENT_URL}/api/v1/entities`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{
    youId: string | null;
    entities: FinanceEntity[];
    createdId: string;
  }>(response);
}

export async function fetchFinanceCategories() {
  const response = await fetch(`${AGENT_URL}/api/v1/categories`, {
    headers: authHeaders(),
  });
  return readJson<{
    period: { year: number; month: number };
    groups: CategoryGroup[];
  }>(response);
}

export async function createFinanceCategory(input: {
  name: string;
  groupId: string;
}) {
  const response = await fetch(`${AGENT_URL}/api/v1/categories`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{ groups: CategoryGroup[]; createdId: string }>(response);
}

export async function patchFinanceCategory(
  id: string,
  input: { name?: string; isArchived?: boolean },
) {
  const response = await fetch(`${AGENT_URL}/api/v1/categories/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{ groups: CategoryGroup[] }>(response);
}

export async function createFinanceCategoryGroup(input: { name: string }) {
  const response = await fetch(`${AGENT_URL}/api/v1/categories/groups`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{ groups: CategoryGroup[]; createdId: string }>(response);
}

export async function fetchUncleared(accountId: string) {
  const response = await fetch(
    `${AGENT_URL}/api/v1/accounts/${accountId}/uncleared`,
    { headers: authHeaders() },
  );
  return readJson<{
    items: Array<{
      id: string;
      date: string;
      memo: string | null;
      amountLabel: string;
      category: { id: string; name: string; slug: string } | null;
    }>;
  }>(response);
}

export async function reconcileFinanceAccount(
  accountId: string,
  transactionIds: string[],
) {
  const response = await fetch(
    `${AGENT_URL}/api/v1/accounts/${accountId}/reconcile`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ transactionIds, reconciled: true }),
    },
  );
  return readJson<{ updated: number }>(response);
}

export async function createPlaidLinkToken(plaidItemId?: string) {
  const response = await fetch(`${AGENT_URL}/api/v1/plaid/link-token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(plaidItemId ? { plaidItemId } : {}),
  });
  return readJson<{
    linkToken?: string;
    env: string;
    sandbox?: boolean;
    error?: string;
  }>(response);
}

export async function exchangePlaidToken(input: {
  publicToken?: string;
  entityId?: string;
  institutionName?: string | null;
  plaidItemId?: string;
}) {
  const response = await fetch(`${AGENT_URL}/api/v1/plaid/exchange`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return readJson<{ itemId: string; feeds: BankFeed[] }>(response);
}

export async function sandboxLinkFinanceBank(entityId: string) {
  const response = await fetch(`${AGENT_URL}/api/v1/plaid/sandbox-link`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ entityId }),
  });
  return readJson<{
    itemId: string;
    feeds: BankFeed[];
    accounts: FinanceAccount[];
  }>(response);
}

export async function syncFinancePlaidItem(id: string) {
  const response = await fetch(`${AGENT_URL}/api/v1/plaid/items/${id}/sync`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return readJson<{ ok?: boolean }>(response);
}

export async function removeFinancePlaidItem(id: string) {
  const response = await fetch(`${AGENT_URL}/api/v1/plaid/items/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return readJson<{ ok: boolean }>(response);
}
