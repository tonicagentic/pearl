import { prisma, type ModelRow, type WhereInput } from "./prisma";
import {
  resolveStatus,
  type RegisterStatus,
} from "./transaction-status";

export {
  normalizeRegisterStatus,
  isInboxCategory,
  resolveStatus,
  type RegisterStatus,
} from "./transaction-status";

export type TransactionListFilters = {
  accountId?: string;
  entityId?: string;
  categoryId?: string;
  tripId?: string;
  inboxOnly?: boolean;
  q?: string;
  from?: Date;
  to?: Date;
  type?: string;
  cursor?: string; // `${isoDate}|${id}` of last row
  limit?: number;
};

export type TransactionListItem = ModelRow<"transaction"> & {
  account: Pick<ModelRow<"account">, "id" | "name" | "type">;
  category:
    | (Pick<ModelRow<"category">, "id" | "name" | "code" | "slug"> & {
        group: Pick<ModelRow<"categoryGroup">, "id" | "name" | "kind" | "code">;
      })
    | null;
  trip: Pick<ModelRow<"trip">, "id" | "name"> | null;
};

function decodeCursor(cursor?: string): { date: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = cursor.split("|");
  if (!iso || !id) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { date, id };
}

export function encodeCursor(row: { date: Date; id: string }) {
  return `${row.date.toISOString()}|${row.id}`;
}

export async function listTransactions(filters: TransactionListFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const cursor = decodeCursor(filters.cursor);

  const where: WhereInput = {};

  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.tripId) where.tripId = filters.tripId;
  if (filters.type) where.type = filters.type;
  if (filters.q?.trim()) {
    where.memo = { contains: filters.q.trim() };
  }
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lt = filters.to;
  }
  if (filters.inboxOnly) {
    const inbox = await prisma.category.findUnique({
      where: { slug: "uncategorized" },
      select: { id: true },
    });
    where.OR = [{ categoryId: null }, ...(inbox ? [{ categoryId: inbox.id }] : [])];
  }

  if (cursor) {
    where.AND = [
      {
        OR: [
          { date: { lt: cursor.date } },
          { date: cursor.date, id: { lt: cursor.id } },
        ],
      },
    ];
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      account: { select: { id: true, name: true, type: true } },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          group: { select: { id: true, name: true, kind: true, code: true } },
        },
      },
      trip: { select: { id: true, name: true } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor(items[items.length - 1]!)
      : null;

  return { items, nextCursor, hasMore };
}

export async function countInbox() {
  const inbox = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });
  return prisma.transaction.count({
    where: {
      OR: [{ categoryId: null }, ...(inbox ? [{ categoryId: inbox.id }] : [])],
    },
  });
}

export async function getRegisterFilterOptions() {
  const [accounts, entities, categories] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, entityId: true, entity: { select: { name: true } } },
      orderBy: [{ entity: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.entity.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        group: { select: { name: true, kind: true, sortOrder: true } },
      },
      orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);
  return { accounts, entities, categories };
}

export type RegisterLedgerRow = {
  id: string;
  date: string;
  amount: number;
  type: string;
  memo: string | null;
  pending: boolean;
  reconciledAt: string | null;
  plaidTxnId: string | null;
  categoryId: string | null;
  billId: string | null;
  tripId: string | null;
  accountId: string;
  entityId: string;
  accountName: string;
  accountType: string;
  categoryName: string | null;
  categorySlug: string | null;
  tripName: string | null;
  balanceAfter: number;
  source: "Imported" | "Manual";
  status: RegisterStatus;
};

/** Full ledger for the client register, with per-account running balances. */
export async function listLedgerForRegister(): Promise<{
  rows: RegisterLedgerRow[];
  oversized: boolean;
}> {
  const [uncategorized, rows] = await Promise.all([
    prisma.category.findUnique({
      where: { slug: "uncategorized" },
      select: { id: true },
    }),
    prisma.transaction.findMany({
      where: { account: { isActive: true } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: {
        account: { select: { id: true, name: true, type: true, balance: true } },
        category: { select: { id: true, name: true, slug: true } },
        trip: { select: { id: true, name: true } },
      },
    }),
  ]);

  const uncategorizedId = uncategorized?.id ?? null;
  const byAccount = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }

  const balanceAfterById = new Map<string, number>();
  for (const [, accountRows] of byAccount) {
    const tipBalance = accountRows[0]?.account.balance ?? 0;
    const sum = accountRows.reduce((s, r) => s + r.amount, 0);
    let running = tipBalance - sum;
    const chronological = [...accountRows].sort((a, b) => {
      const d = a.date.getTime() - b.date.getTime();
      if (d !== 0) return d;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    for (const r of chronological) {
      running += r.amount;
      balanceAfterById.set(r.id, running);
    }
  }

  const mapped: RegisterLedgerRow[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    amount: r.amount,
    type: r.type,
    memo: r.memo,
    pending: r.pending,
    reconciledAt: r.reconciledAt?.toISOString() ?? null,
    plaidTxnId: r.plaidTxnId,
    categoryId: r.categoryId,
    billId: r.billId,
    tripId: r.tripId,
    accountId: r.accountId,
    entityId: r.entityId,
    accountName: r.account.name,
    accountType: r.account.type,
    categoryName: r.category?.name ?? null,
    categorySlug: r.category?.slug ?? null,
    tripName: r.trip?.name ?? null,
    balanceAfter: balanceAfterById.get(r.id) ?? 0,
    source: r.plaidTxnId ? "Imported" : "Manual",
    status: resolveStatus({
      pending: r.pending,
      categoryId: r.categoryId,
      categorySlug: r.category?.slug ?? null,
      reconciledAt: r.reconciledAt,
      uncategorizedId,
    }),
  }));

  return { rows: mapped, oversized: mapped.length > 5000 };
}
