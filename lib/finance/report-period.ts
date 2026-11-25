import { currentYearMonth } from "@/lib/finance/money";
import { parseReportPeriod, periodBounds } from "@/lib/finance/reports";
import { prisma } from "@/lib/finance/prisma";

export type ReportSearchParams = {
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
  from?: string;
  to?: string;
  entityId?: string;
};

export async function resolveReportContext(sp: ReportSearchParams) {
  const period = parseReportPeriod(sp);
  const { from, to, label } = periodBounds(period);
  const now = currentYearMonth();
  const year =
    period.kind === "custom"
      ? from.getFullYear()
      : period.kind === "month" || period.kind === "quarter" || period.kind === "ytd"
        ? period.year
        : now.year;
  const month =
    period.kind === "month" ? period.month : now.month;
  const quarter = period.kind === "quarter" ? period.quarter : 1;
  const entityId = sp.entityId || undefined;
  const entities = await prisma.entity.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return { period, from, to, label, year, month, quarter, entityId, entities };
}

export function transactionsHref(opts: {
  from: Date;
  to: Date;
  entityId?: string;
  categoryId?: string | null;
  type?: string;
}) {
  const p = new URLSearchParams();
  p.set("from", opts.from.toISOString().slice(0, 10));
  p.set("to", opts.to.toISOString().slice(0, 10));
  if (opts.entityId) p.set("entityId", opts.entityId);
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  if (opts.type) p.set("type", opts.type);
  return `/transactions?${p.toString()}`;
}

/** Pearl Finances drilldown (stays in the main app, not Pearl Money). */
export function financesTransactionsHref(opts: {
  from: Date;
  to: Date;
  year?: number;
  month?: number;
  categoryId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  /** Defaults to web `/finances/transactions`; mobile passes the same path. */
  basePath?: string;
}) {
  const p = new URLSearchParams();
  p.set("from", opts.from.toISOString().slice(0, 10));
  p.set("to", opts.to.toISOString().slice(0, 10));
  if (opts.year) p.set("year", String(opts.year));
  if (opts.month) p.set("month", String(opts.month));
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  if (opts.groupId) p.set("groupId", opts.groupId);
  if (opts.groupName) p.set("groupName", opts.groupName);
  const base = opts.basePath ?? "/finances/transactions";
  return `${base}?${p.toString()}`;
}
