import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import { SpendSankey } from "@/components/finances/spend-sankey";
import { getMonthSpendSummaryCached } from "@/lib/finance/spend-cache";
import { buildSpendSankeyGraph } from "@/lib/finance/spend-sankey";
import { currentYearMonth } from "@/lib/finance/money";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Finances",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseYearMonth(sp: Record<string, string | string[] | undefined>) {
  const now = currentYearMonth();
  const yearRaw = Number(firstParam(sp.year));
  const monthRaw = Number(firstParam(sp.month));
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? Math.trunc(yearRaw)
      : now.year;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? Math.trunc(monthRaw)
      : now.month;
  return { year, month };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function financesHref(year: number, month: number) {
  const p = new URLSearchParams();
  p.set("year", String(year));
  p.set("month", String(month));
  return `/finances?${p.toString()}`;
}

export default function FinancesPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <FinancesPageFrame>
      <Suspense fallback={<FinancesFallback />}>
        <ResolvedFinances searchParams={searchParams} />
      </Suspense>
    </FinancesPageFrame>
  );
}

async function ResolvedFinances({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to see finances." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <FinancesCard message="Finance database is not configured for this environment." />
    );
  }

  const params = await searchParams;
  const { year, month } = parseYearMonth(params);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const now = currentYearMonth();
  const nextDisabled =
    next.year > now.year ||
    (next.year === now.year && next.month > now.month);

  const summary = await getMonthSpendSummaryCached(viewer.id, year, month);
  const graph = buildSpendSankeyGraph(summary);

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Finances</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(year, month)} · spent {summary.totalSpentLabel}
          </p>
        </div>
        <nav
          className="flex items-center gap-1"
          aria-label="Month navigation"
        >
          <Link
            href={financesHref(prev.year, prev.month)}
            className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="min-w-[8.5rem] text-center text-sm font-medium tabular-nums">
            {monthLabel(year, month)}
          </span>
          {nextDisabled ? (
            <span
              className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground/40"
              aria-disabled
            >
              <ChevronRightIcon className="size-4" />
            </span>
          ) : (
            <Link
              href={financesHref(next.year, next.month)}
              className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </Link>
          )}
        </nav>
      </header>

      <section className="rounded-lg border bg-card px-3 py-4 sm:px-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Spend by category
          </h2>
          <p className="text-base font-semibold tabular-nums">
            {summary.totalSpentLabel}
          </p>
        </div>
        <SpendSankey graph={graph} />
      </section>
    </>
  );
}

function FinancesFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading finances…
    </div>
  );
}

function FinancesCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Finances</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function FinancesPageFrame({ children }: { readonly children: ReactNode }) {
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
