export function formatMoney(amount: number, opts?: { signed?: boolean }): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(abs);
  if (opts?.signed) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `−${formatted}`;
  }
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

/**
 * Postgres `numeric` columns come back as strings; coerce to a JS number.
 * Null/undefined/NaN become 0 — use only where the old Prisma field was a
 * non-null Float. (The Prisma shim keeps nullable money columns as null.)
 */
export function moneyNum(value: unknown): number {
  return Number(value) || 0;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

export function monthlyEquivalent(amount: number, cadence: string): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "annual":
      return amount / 12;
    case "one_time":
      return amount;
    case "monthly":
    default:
      return amount;
  }
}

export function currentYearMonth(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}
