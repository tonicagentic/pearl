import { prisma } from "./prisma";
import { decryptSecret } from "./crypto";
import { getPlaidClient } from "./plaid";
import {
  isSkippableRefreshError,
  plaidErrorCode,
  shouldRefreshPlaidItem,
} from "./plaid-freshness";
import { ensurePlaidItemWebhook } from "./plaid-webhook";

/** Map Plaid API errors to a `plaid_items.status` value. */
export function plaidItemStatusFromError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toUpperCase();
  const code = plaidErrorCode(err);
  const haystack = `${code} ${msg}`;
  if (
    haystack.includes("ITEM_LOGIN_REQUIRED") ||
    haystack.includes("PENDING_EXPIRATION")
  ) {
    return "login_required";
  }
  return "error";
}

async function markPlaidItemStatus(plaidItemId: string, status: string) {
  await prisma.plaidItem.update({
    where: { id: plaidItemId },
    data: { status, updatedAt: new Date() },
  });
}

function mapAccountType(type?: string | null, subtype?: string | null) {
  if (type === "credit") return "credit";
  if (type === "loan") return "loan";
  if (type === "investment" || subtype === "brokerage") return "brokerage";
  return "bank";
}

function mapTxnType(amount: number) {
  if (amount < 0) return "income"; // Plaid: positive = money leaving account
  return "expense";
}

async function runInChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

/** Refresh account balances for a linked item. */
export async function syncPlaidBalances(plaidItemId: string) {
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: plaidItemId },
    include: { accounts: true },
  });
  const client = getPlaidClient();
  const accessToken = decryptSecret(item.accessTokenEnc);
  const res = await client.accounts.get({ access_token: accessToken });

  const updates = res.accounts
    .map((a) => {
      const existing = item.accounts.find((x) => x.plaidAccountId === a.account_id);
      if (!existing) return null;
      return prisma.account.update({
        where: { id: existing.id },
        data: {
          balance: a.balances?.current ?? existing.balance,
          balanceAsOf: new Date(),
          name: a.official_name ?? a.name ?? existing.name,
          type: mapAccountType(a.type, a.subtype),
        },
      });
    })
    .filter(Boolean);

  await runInChunks(updates, 25, async (chunk) => {
    await prisma.$transaction(chunk as ReturnType<typeof prisma.account.update>[]);
  });
}

type SyncOp = {
  kind: "upsert";
  plaidTxnId: string;
  accountId: string;
  entityId: string;
  date: Date;
  amount: number;
  type: string;
  memo: string;
  pending: boolean;
  isNew: boolean;
};

/**
 * Pull transactions via /transactions/sync and upsert into the Transactions register.
 * Preserves local categoryId, billId, and type on modify.
 */
export async function syncPlaidTransactions(plaidItemId: string) {
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: plaidItemId },
    include: { accounts: true },
  });
  const client = getPlaidClient();
  const accessToken = decryptSecret(item.accessTokenEnc);
  const accountByPlaidId = new Map(
    item.accounts.filter((a) => a.plaidAccountId).map((a) => [a.plaidAccountId!, a]),
  );

  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  let added = 0;
  let modified = 0;
  let removed = 0;

  const inbox = await prisma.category.findUnique({ where: { slug: "uncategorized" } });

  while (hasMore) {
    const page = await client.transactions.sync({
      access_token: accessToken,
      cursor,
      count: 100,
    });

    const ops: SyncOp[] = [];

    for (const t of page.added) {
      const account = accountByPlaidId.get(t.account_id);
      if (!account) continue;
      ops.push({
        kind: "upsert",
        plaidTxnId: t.transaction_id,
        accountId: account.id,
        entityId: account.entityId,
        date: new Date(t.date),
        amount: -(t.amount ?? 0),
        type: mapTxnType(t.amount ?? 0),
        memo: t.name ?? t.merchant_name ?? "Plaid transaction",
        pending: Boolean(t.pending),
        isNew: true,
      });
    }

    for (const t of page.modified) {
      const account = accountByPlaidId.get(t.account_id);
      if (!account) continue;
      ops.push({
        kind: "upsert",
        plaidTxnId: t.transaction_id,
        accountId: account.id,
        entityId: account.entityId,
        date: new Date(t.date),
        amount: -(t.amount ?? 0),
        type: mapTxnType(t.amount ?? 0),
        memo: t.name ?? t.merchant_name ?? "Plaid transaction",
        pending: Boolean(t.pending),
        isNew: false,
      });
    }

    await runInChunks(ops, 25, async (chunk) => {
      for (const op of chunk) {
        const existing = await prisma.transaction.findUnique({
          where: { plaidTxnId: op.plaidTxnId },
          select: { id: true },
        });
        if (existing) {
          await prisma.transaction.update({
            where: { id: existing.id },
            // Preserve categoryId, billId, type — only refresh bank facts
            data: {
              date: op.date,
              amount: op.amount,
              memo: op.memo,
              pending: op.pending,
              accountId: op.accountId,
              entityId: op.entityId,
            },
          });
          if (!op.isNew) modified += 1;
          continue;
        }

        // Collapse same-day fingerprint dupes (Plaid can re-issue transaction_id).
        const dayStart = new Date(op.date);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const twin = await prisma.transaction.findFirst({
          where: {
            accountId: op.accountId,
            amount: op.amount,
            date: { gte: dayStart, lt: dayEnd },
            memo: op.memo,
            plaidTxnId: { not: null },
          },
          select: { id: true, plaidTxnId: true },
        });
        if (twin) {
          await prisma.transaction.update({
            where: { id: twin.id },
            data: {
              plaidTxnId: op.plaidTxnId,
              date: op.date,
              amount: op.amount,
              memo: op.memo,
              pending: op.pending,
            },
          });
          modified += 1;
          continue;
        }

        await prisma.transaction.create({
          data: {
            accountId: op.accountId,
            entityId: op.entityId,
            date: op.date,
            amount: op.amount,
            type: op.type,
            memo: op.memo,
            pending: op.pending,
            categoryId: inbox?.id ?? null,
            plaidTxnId: op.plaidTxnId,
          },
        });
        added += 1;
      }
    });

    const removedIds = page.removed
      .map((t) => t.transaction_id)
      .filter((id): id is string => Boolean(id));
    if (removedIds.length) {
      await runInChunks(removedIds, 50, async (chunk) => {
        const res = await prisma.transaction.deleteMany({
          where: { plaidTxnId: { in: chunk } },
        });
        removed += res.count;
      });
    }

    cursor = page.next_cursor;
    hasMore = page.has_more;
  }

  const now = new Date();
  await prisma.plaidItem.update({
    where: { id: plaidItemId },
    data: {
      cursor: cursor ?? null,
      updatedAt: now,
      lastSyncedAt: now,
      status: "active",
    },
  });

  return { added, modified, removed };
}

export type EnsurePlaidFreshOptions = {
  /** Bypass the 18h refresh throttle. */
  forceRefresh?: boolean;
  /** When false, only `/transactions/sync` (daily books). Default true for view/manual. */
  allowRefresh?: boolean;
};

/**
 * Optionally call `/transactions/refresh` when stale, then sync balances + transactions.
 * Refresh is async at Plaid; webhooks complete the next sync when extraction finishes.
 */
export async function ensurePlaidItemFresh(
  plaidItemId: string,
  opts?: EnsurePlaidFreshOptions,
) {
  const allowRefresh = opts?.allowRefresh !== false;
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: plaidItemId },
    select: {
      id: true,
      status: true,
      accessTokenEnc: true,
      lastRefreshedAt: true,
    },
  });

  let refreshed = false;
  let refreshSkipped: string | null = null;

  if (
    allowRefresh &&
    shouldRefreshPlaidItem({
      status: item.status,
      lastRefreshedAt: item.lastRefreshedAt,
      forceRefresh: opts?.forceRefresh,
    })
  ) {
    try {
      const client = getPlaidClient();
      const accessToken = decryptSecret(item.accessTokenEnc);
      await ensurePlaidItemWebhook(accessToken);
      await client.transactions.refresh({ access_token: accessToken });
      await prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: { lastRefreshedAt: new Date() },
      });
      refreshed = true;
    } catch (err) {
      if (isSkippableRefreshError(err)) {
        refreshSkipped = plaidErrorCode(err) || "REFRESH_SKIPPED";
        console.warn(
          "[plaid] transactions.refresh skipped for",
          plaidItemId,
          refreshSkipped,
        );
      } else {
        try {
          await markPlaidItemStatus(plaidItemId, plaidItemStatusFromError(err));
        } catch {
          // Ignore status update failures so the original error surfaces
        }
        throw err;
      }
    }
  }

  const sync = await syncPlaidItem(plaidItemId);
  return { ...sync, refreshed, refreshSkipped };
}

export async function syncPlaidItem(plaidItemId: string) {
  try {
    await syncPlaidBalances(plaidItemId);
    const result = await syncPlaidTransactions(plaidItemId);
    await markPlaidItemStatus(plaidItemId, "active");
    return result;
  } catch (err) {
    try {
      await markPlaidItemStatus(plaidItemId, plaidItemStatusFromError(err));
    } catch {
      // Ignore status update failures so the original sync error surfaces
    }
    throw err;
  }
}
