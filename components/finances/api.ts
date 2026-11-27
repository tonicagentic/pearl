export type FinanceAccount = {
  id: string;
  name: string;
  type: string;
  source: string;
  sourceLabel: string;
  currency: string;
  balance: number;
  balanceLabel: string;
  booksBalance: number;
  booksBalanceLabel: string;
  balanceAsOf: string;
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
  updatedAt: string;
  lastSyncedAt: string | null;
  lastRefreshedAt: string | null;
};

export type FinanceEntity = {
  id: string;
  name: string;
  slug: string;
  taxClass: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  sortOrder: number;
  monthActual: number;
  monthActualLabel: string;
};

export type CategoryGroup = {
  id: string;
  name: string;
  kind: string;
  slug: string;
  categories: CategoryRow[];
};

export type RegisterTransaction = {
  id: string;
  date: string;
  memo: string | null;
  amount: number;
  amountLabel: string;
  type: string;
  pending: boolean;
  reconciledAt: string | null;
  status: "pending" | "inbox" | "categorized" | "cleared";
  account: { id: string; name: string; type: string } | null;
  category: {
    id: string;
    name: string;
    code: string | null;
    slug?: string;
    groupName: string | null;
  } | null;
};

export type FilterOptions = {
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    entityId: string;
    entityName: string;
  }>;
  entities: Array<{ id: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    code: string | null;
    slug: string;
    groupName: string;
    groupKind: string;
  }>;
};

async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed (${response.status})`);
  }
  return json as T;
}

export async function fetchAccounts() {
  return readJson<{ accounts: FinanceAccount[]; feeds: BankFeed[] }>(
    await fetch("/api/v1/accounts", { cache: "no-store" }),
  );
}

export async function fetchEntities() {
  return readJson<{ youId: string | null; entities: FinanceEntity[] }>(
    await fetch("/api/v1/entities", { cache: "no-store" }),
  );
}

export async function createEntity(input: {
  name: string;
  taxClass: string;
}) {
  return readJson<{ youId: string | null; entities: FinanceEntity[]; createdId: string }>(
    await fetch("/api/v1/entities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchCategories() {
  return readJson<{
    period: { year: number; month: number };
    groups: CategoryGroup[];
    groupOptions: Array<{ id: string; name: string; kind: string; slug: string }>;
  }>(await fetch("/api/v1/categories", { cache: "no-store" }));
}

export async function createCategory(input: {
  name: string;
  groupId: string;
}) {
  return readJson<{ groups: CategoryGroup[]; createdId: string }>(
    await fetch("/api/v1/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function patchCategory(
  id: string,
  input: { name?: string; isArchived?: boolean },
) {
  return readJson<{ groups: CategoryGroup[] }>(
    await fetch(`/api/v1/categories/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function createCategoryGroup(input: {
  name: string;
  kind?: "lifestyle" | "cash_only";
}) {
  return readJson<{ groups: CategoryGroup[]; createdId: string }>(
    await fetch("/api/v1/categories/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function patchCategoryGroup(
  id: string,
  input: { name?: string },
) {
  return readJson<{ groups: CategoryGroup[] }>(
    await fetch(`/api/v1/categories/groups/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchTransactions(params: URLSearchParams) {
  return readJson<{
    items: RegisterTransaction[];
    nextCursor: string | null;
    hasMore: boolean;
    filterOptions: FilterOptions;
  }>(
    await fetch(`/api/v1/finances/transactions?${params.toString()}`, {
      cache: "no-store",
    }),
  );
}

export async function patchTransaction(
  id: string,
  input: { categoryId?: string | null; reconcile?: boolean },
) {
  return readJson<{
    item: {
      id: string;
      date: string;
      memo: string | null;
      amount: number;
      amountLabel: string;
      type: string;
      pending: boolean;
      account: { id: string; name: string; type: string } | null;
      category: {
        id: string;
        name: string;
        code: string | null;
        groupName: string | null;
      } | null;
      trip: { id: string; name: string } | null;
    };
  }>(
    await fetch(`/api/v1/transactions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchUncleared(accountId: string) {
  return readJson<{
    accountId: string;
    items: Array<{
      id: string;
      date: string;
      memo: string | null;
      amount: number;
      amountLabel: string;
      type: string;
      category: { id: string; name: string; slug: string } | null;
    }>;
  }>(
    await fetch(`/api/v1/accounts/${accountId}/uncleared`, {
      cache: "no-store",
    }),
  );
}

export async function reconcileAccount(
  accountId: string,
  transactionIds: string[],
  reconciled = true,
) {
  return readJson<{
    accountId: string;
    updated: number;
    accountIds: string[];
  }>(
    await fetch(`/api/v1/accounts/${accountId}/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionIds, reconciled }),
    }),
  );
}

export async function createLinkToken(plaidItemId?: string) {
  return readJson<{
    linkToken?: string;
    env: string;
    sandbox?: boolean;
    error?: string;
  }>(
    await fetch("/api/v1/plaid/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(plaidItemId ? { plaidItemId } : {}),
    }),
  );
}

export async function exchangePlaid(input: {
  publicToken?: string;
  entityId?: string;
  institutionName?: string | null;
  plaidItemId?: string;
}) {
  return readJson<{ itemId: string; feeds: BankFeed[] }>(
    await fetch("/api/v1/plaid/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function sandboxLinkBank(entityId: string) {
  return readJson<{
    itemId: string;
    feeds: BankFeed[];
    accounts: FinanceAccount[];
  }>(
    await fetch("/api/v1/plaid/sandbox-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityId }),
    }),
  );
}

export async function syncPlaidItem(id: string) {
  return readJson<{ added?: number; modified?: number; removed?: number }>(
    await fetch(`/api/v1/plaid/items/${id}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
}

export async function removePlaidItem(id: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/v1/plaid/items/${id}`, { method: "DELETE" }),
  );
}
