import { format } from "date-fns";
import { listAccountsForRegister } from "@/lib/finance/accounts";
import { computeMonthLifestyle } from "@/lib/finance/lifestyle";
import { formatMoney, currentYearMonth } from "@/lib/finance/money";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { incomeStatement, periodBounds } from "@/lib/finance/reports";
import { listTransactions, type TransactionListFilters } from "@/lib/finance/transactions";
import { isUpcomingTrip, plannedTotal } from "@/lib/finance/trips";
import { prisma } from "@/lib/finance/prisma";

export async function buildSummaryPayload() {
  const now = new Date();
  const { year, month } = currentYearMonth(now);
  const thisMonth = periodBounds({ kind: "month", year, month });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [monthIncome, netWorth, lifestyle, bills, trips] = await Promise.all([
    incomeStatement({ from: thisMonth.from, to: thisMonth.to }),
    computeNetWorth(year),
    computeMonthLifestyle(year, month),
    prisma.bill.findMany({
      where: {
        isActive: true,
        amount: { gt: 0 },
        prescription: { is: null },
        visionSupply: { is: null },
        recurringSeries: { is: null },
      },
      orderBy: { nextDate: "asc" },
      include: { category: { select: { name: true } } },
      take: 20,
    }),
    prisma.trip.findMany({
      include: { lines: true },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      take: 20,
    }),
  ]);

  const made = monthIncome.totalIncome;
  const spent = monthIncome.totalExpenses + monthIncome.totalTaxes;
  const net = made - spent;

  type Upcoming = {
    id: string;
    kind: "bill" | "trip";
    title: string;
    detail: string;
    date: string | null;
    amount: number | null;
    amountLabel: string | null;
  };

  const upcoming: Upcoming[] = [];

  for (const b of bills) {
    if (b.nextDate && b.nextDate < startOfToday) continue;
    upcoming.push({
      id: `bill-${b.id}`,
      kind: "bill",
      title: b.name,
      detail: [
        b.nextDate ? format(b.nextDate, "MMM d, yyyy") : b.cadence,
        b.category.name,
      ]
        .filter(Boolean)
        .join(" · "),
      date: b.nextDate?.toISOString() ?? null,
      amount: b.amount,
      amountLabel: formatMoney(b.amount),
    });
    if (upcoming.length >= 8) break;
  }

  for (const t of trips.filter(isUpcomingTrip)) {
    upcoming.push({
      id: `trip-${t.id}`,
      kind: "trip",
      title: t.name,
      detail: [
        t.destination ?? "Destination TBD",
        t.startDate ? format(t.startDate, "MMM d, yyyy") : null,
      ]
        .filter(Boolean)
        .join(" · "),
      date: t.startDate?.toISOString() ?? null,
      amount: plannedTotal(t.lines),
      amountLabel: formatMoney(plannedTotal(t.lines)),
    });
  }

  upcoming.sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return {
    asOf: now.toISOString(),
    period: { year, month, label: thisMonth.label },
    month: {
      made,
      spent,
      net,
      madeLabel: formatMoney(made),
      spentLabel: formatMoney(spent),
      netLabel: formatMoney(net, { signed: true }),
    },
    netWorth: {
      total: netWorth.netWorth,
      totalLabel: formatMoney(netWorth.netWorth),
      composition: netWorth.composition,
    },
    lifestyle: {
      lifestyleCost: lifestyle.lifestyleCost,
      cashPaid: lifestyle.cashPaid,
      lifestyleCostLabel: formatMoney(lifestyle.lifestyleCost),
      cashPaidLabel: formatMoney(lifestyle.cashPaid),
    },
    upcoming: upcoming.slice(0, 10),
  };
}

export async function buildTransactionsPayload(opts?: TransactionListFilters) {
  const result = await listTransactions({
    limit: opts?.limit ?? 40,
    cursor: opts?.cursor,
    accountId: opts?.accountId,
    entityId: opts?.entityId,
    categoryId: opts?.categoryId,
    tripId: opts?.tripId,
    inboxOnly: opts?.inboxOnly,
    q: opts?.q,
    from: opts?.from,
    to: opts?.to,
    type: opts?.type,
  });

  return {
    items: result.items.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      memo: t.memo,
      amount: t.amount,
      amountLabel: formatMoney(t.amount, { signed: true }),
      type: t.type,
      account: t.account
        ? { id: t.account.id, name: t.account.name, type: t.account.type }
        : null,
      category: t.category
        ? {
            id: t.category.id,
            name: t.category.name,
            code: t.category.code,
            groupName: t.category.group?.name ?? null,
          }
        : null,
      trip: t.trip ? { id: t.trip.id, name: t.trip.name } : null,
      pending: t.pending,
    })),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function buildAccountsPayload() {
  const { rows, feeds } = await listAccountsForRegister();
  return {
    accounts: rows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      source: a.source,
      sourceLabel: a.sourceLabel,
      currency: a.currency,
      balance: a.balance,
      balanceLabel: formatMoney(a.balance),
      booksBalance: a.booksBalance,
      booksBalanceLabel: formatMoney(a.booksBalance),
      balanceAsOf: a.balanceAsOf,
      entityName: a.entityName,
      inboxCount: a.inboxCount,
      unclearedCount: a.unclearedCount,
      needsReconcile: a.needsReconcile,
      institutionName: a.institutionName,
    })),
    feeds,
  };
}
