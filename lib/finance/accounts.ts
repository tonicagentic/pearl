import { prisma } from "./prisma";
import { isInboxCategory } from "./transaction-status";

export type AccountRegisterRow = {
  id: string;
  name: string;
  type: string;
  source: string;
  sourceLabel: "Manual" | "Plaid";
  currency: string;
  /** Bank/statement balance (Plaid current or manual override). */
  balance: number;
  /** Cleared books position: statement minus uncleared activity. */
  booksBalance: number;
  balanceAsOf: string;
  entityId: string;
  entityName: string;
  /** Uncleared lines (reconciledAt null, excluding pending). */
  unclearedCount: number;
  inboxCount: number;
  unclearedSum: number;
  needsReconcile: boolean;
  plaidItemId: string | null;
  institutionName: string | null;
  plaidItemStatus: string | null;
  plaidItemUpdatedAt: string | null;
};

export type BankFeedItem = {
  id: string;
  institutionName: string;
  status: string;
  accountCount: number;
  updatedAt: string;
  lastSyncedAt: string | null;
  lastRefreshedAt: string | null;
};

function sourceLabel(source: string): AccountRegisterRow["sourceLabel"] {
  if (source === "plaid") return "Plaid";
  return "Manual";
}

export async function listAccountsForRegister(): Promise<{
  rows: AccountRegisterRow[];
  entities: { id: string; name: string }[];
  feeds: BankFeedItem[];
}> {
  const [accounts, unclearedTxns, plaidItems, uncategorized] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      include: {
        entity: { select: { id: true, name: true } },
        plaidItem: {
          select: {
            id: true,
            institutionName: true,
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ entity: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        reconciledAt: null,
        pending: false,
        account: { isActive: true },
      },
      select: {
        accountId: true,
        amount: true,
        categoryId: true,
        category: { select: { slug: true } },
      },
    }),
    prisma.plaidItem.findMany({
      include: { _count: { select: { accounts: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findUnique({
      where: { slug: "uncategorized" },
      select: { id: true },
    }),
  ]);

  const uncategorizedId = uncategorized?.id ?? null;
  const statsByAccount = new Map<
    string,
    { count: number; inbox: number; sum: number }
  >();
  for (const t of unclearedTxns) {
    const cur = statsByAccount.get(t.accountId) ?? {
      count: 0,
      inbox: 0,
      sum: 0,
    };
    cur.count += 1;
    cur.sum += t.amount;
    if (
      isInboxCategory({
        categoryId: t.categoryId,
        categorySlug: t.category?.slug ?? null,
        uncategorizedId,
      })
    ) {
      cur.inbox += 1;
    }
    statsByAccount.set(t.accountId, cur);
  }

  const rows: AccountRegisterRow[] = accounts.map((a) => {
    const stats = statsByAccount.get(a.id) ?? {
      count: 0,
      inbox: 0,
      sum: 0,
    };
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      source: a.source,
      sourceLabel: sourceLabel(a.source),
      currency: a.currency,
      balance: a.balance,
      booksBalance: a.balance - stats.sum,
      balanceAsOf: (a.balanceAsOf ?? a.updatedAt).toISOString(),
      entityId: a.entityId,
      entityName: a.entity.name,
      unclearedCount: stats.count,
      inboxCount: stats.inbox,
      unclearedSum: stats.sum,
      needsReconcile: stats.count > 0,
      plaidItemId: a.plaidItemId,
      institutionName: a.plaidItem?.institutionName ?? null,
      plaidItemStatus: a.plaidItem?.status ?? null,
      plaidItemUpdatedAt: a.plaidItem?.updatedAt.toISOString() ?? null,
    };
  });

  return {
    rows,
    entities: [
      ...new Map(
        accounts.map((a) => [a.entity.id, { id: a.entity.id, name: a.entity.name }]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    feeds: plaidItems.map((p) => {
      const synced = p.lastSyncedAt ?? p.updatedAt;
      return {
        id: p.id,
        institutionName: p.institutionName ?? "Bank",
        status: p.status,
        accountCount: p._count.accounts,
        updatedAt: p.updatedAt.toISOString(),
        lastSyncedAt: synced ? synced.toISOString() : null,
        lastRefreshedAt: p.lastRefreshedAt?.toISOString() ?? null,
      };
    }),
  };
}

export type AccountReconcileSummary = {
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
    entityName: string;
    source: string;
    institutionName: string | null;
  };
  statementBalance: number;
  statementAsOf: string;
  booksBalance: number;
  variance: number;
  unclearedCount: number;
  inboxCount: number;
  clearedCount: number;
  pendingCount: number;
  unclearedSum: number;
};

export type AccountReconcileLine = {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  status: "inbox" | "categorized";
  source: "Imported" | "Manual";
};

export async function getAccountReconcileView(accountId: string): Promise<{
  summary: AccountReconcileSummary;
  uncleared: AccountReconcileLine[];
  categories: { id: string; label: string }[];
} | null> {
  const [account, uncategorized, categories] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, isActive: true },
      include: {
        entity: { select: { name: true } },
        plaidItem: { select: { institutionName: true } },
      },
    }),
    prisma.category.findUnique({
      where: { slug: "uncategorized" },
      select: { id: true },
    }),
    prisma.category.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        group: { select: { name: true } },
      },
      orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  if (!account) return null;

  const uncategorizedId = uncategorized?.id ?? null;

  const [unclearedRows, clearedCount, pendingCount] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        accountId,
        reconciledAt: null,
        pending: false,
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.transaction.count({
      where: { accountId, reconciledAt: { not: null }, pending: false },
    }),
    prisma.transaction.count({
      where: { accountId, pending: true },
    }),
  ]);

  const unclearedSum = unclearedRows.reduce((s, t) => s + t.amount, 0);
  let inboxCount = 0;
  const uncleared: AccountReconcileLine[] = unclearedRows.map((t) => {
    const inbox = isInboxCategory({
      categoryId: t.categoryId,
      categorySlug: t.category?.slug ?? null,
      uncategorizedId,
    });
    if (inbox) inboxCount += 1;
    return {
      id: t.id,
      date: t.date.toISOString(),
      amount: t.amount,
      memo: t.memo,
      type: t.type,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
      status: inbox ? "inbox" : "categorized",
      source: t.plaidTxnId ? "Imported" : "Manual",
    };
  });

  const statementBalance = account.balance;
  const booksBalance = statementBalance - unclearedSum;

  return {
    summary: {
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        entityName: account.entity.name,
        source: account.source,
        institutionName: account.plaidItem?.institutionName ?? null,
      },
      statementBalance,
      statementAsOf: (account.balanceAsOf ?? account.updatedAt).toISOString(),
      booksBalance,
      variance: statementBalance - booksBalance,
      unclearedCount: uncleared.length,
      inboxCount,
      clearedCount,
      pendingCount,
      unclearedSum,
    },
    uncleared,
    categories: categories.map((c) => ({
      id: c.id,
      label: `${c.group.name} · ${c.name}`,
    })),
  };
}
