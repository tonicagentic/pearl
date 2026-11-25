import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import { withUserDb } from "@/lib/finance/db";
import { formatMoney, monthBounds } from "@/lib/finance/money";
import { prisma } from "@/lib/finance/prisma";
import {
  listTransactions,
  type TransactionListItem,
} from "@/lib/finance/transactions";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Transactions · Finances",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDay(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function financesMonthHref(year?: number, month?: number) {
  if (!year || !month) return "/finances";
  const p = new URLSearchParams();
  p.set("year", String(year));
  p.set("month", String(month));
  return `/finances?${p.toString()}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export default function FinancesTransactionsPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <PageFrame>
      <Suspense fallback={<Fallback />}>
        <Resolved searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}

async function Resolved({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <Card message="Sign in with durable storage configured to see transactions." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <Card message="Finance database is not configured for this environment." />
    );
  }

  const params = await searchParams;
  const year = Number(firstParam(params.year)) || undefined;
  const month = Number(firstParam(params.month)) || undefined;
  const categoryId = firstParam(params.categoryId) || undefined;
  const groupId = firstParam(params.groupId) || undefined;
  const groupName = firstParam(params.groupName) || undefined;
  const cursor = firstParam(params.cursor) || undefined;

  let from = parseDay(firstParam(params.from));
  let to = parseDay(firstParam(params.to));
  if ((!from || !to) && year && month) {
    const bounds = monthBounds(year, month);
    from = from ?? bounds.start;
    to = to ?? bounds.end;
  }

  const result = await withUserDb(viewer.id, async () => {
    let categoryIds: string[] | undefined;
    let title = "Transactions";

    if (categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, name: true },
      });
      title = cat?.name ?? "Category";
      categoryIds = [categoryId];
    } else if (groupId) {
      const group = await prisma.categoryGroup.findUnique({
        where: { id: groupId },
        select: { id: true, name: true },
      });
      title = group?.name ?? "Group";
      const cats = await prisma.category.findMany({
        where: { groupId },
        select: { id: true },
      });
      categoryIds = cats.map((c) => c.id);
      if (categoryIds.length === 0) {
        return {
          title,
          items: [] as TransactionListItem[],
          nextCursor: null as string | null,
          emptyReason: "No categories in this group.",
        };
      }
    } else if (groupName) {
      title = groupName;
      const cats = await prisma.category.findMany({
        where: { group: { name: groupName } },
        select: { id: true },
      });
      categoryIds = cats.map((c) => c.id);
      // Inbox / uncategorized may have null categoryId rows.
      if (groupName.toLowerCase() === "inbox") {
        const page = await listTransactions({
          from: from ?? undefined,
          to: to ?? undefined,
          inboxOnly: true,
          cursor,
          limit: 50,
        });
        return {
          title,
          items: page.items,
          nextCursor: page.nextCursor,
          emptyReason: null as string | null,
        };
      }
      if (categoryIds.length === 0) {
        return {
          title,
          items: [] as TransactionListItem[],
          nextCursor: null as string | null,
          emptyReason: "No matching categories.",
        };
      }
    }

    const page = await listTransactions({
      from: from ?? undefined,
      to: to ?? undefined,
      ...(categoryIds
        ? { categoryIds }
        : categoryId
          ? { categoryId }
          : {}),
      cursor,
      limit: 50,
    });

    return {
      title,
      items: page.items,
      nextCursor: page.nextCursor,
      emptyReason: null as string | null,
    };
  });

  const backHref = financesMonthHref(year, month);
  const period =
    year && month
      ? monthLabel(year, month)
      : from && to
        ? `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
        : "Selected period";

  const nextHref = result.nextCursor
    ? (() => {
        const p = new URLSearchParams();
        if (from) p.set("from", from.toISOString().slice(0, 10));
        if (to) p.set("to", to.toISOString().slice(0, 10));
        if (year) p.set("year", String(year));
        if (month) p.set("month", String(month));
        if (categoryId) p.set("categoryId", categoryId);
        if (groupId) p.set("groupId", groupId);
        if (groupName) p.set("groupName", groupName);
        p.set("cursor", result.nextCursor!);
        return `/finances/transactions?${p.toString()}`;
      })()
    : null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to Finances
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{result.title}</h1>
          <p className="text-sm text-muted-foreground">{period}</p>
        </div>
      </header>

      {result.emptyReason ? (
        <p className="text-sm text-muted-foreground">{result.emptyReason}</p>
      ) : result.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions in this filter.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {result.items.map((txn) => (
            <li
              key={txn.id}
              className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {txn.memo?.trim() || "Untitled"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {txn.date.toISOString().slice(0, 10)}
                  {txn.category?.name ? ` · ${txn.category.name}` : ""}
                  {txn.account?.name ? ` · ${txn.account.name}` : ""}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">
                {formatMoney(Number(txn.amount))}
              </p>
            </li>
          ))}
        </ul>
      )}

      {nextHref ? (
        <div className="flex justify-center">
          <Link
            href={nextHref}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Load more
          </Link>
        </div>
      ) : null}
    </>
  );
}

function Fallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading transactions…
    </div>
  );
}

function Card({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Transactions</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function PageFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}
