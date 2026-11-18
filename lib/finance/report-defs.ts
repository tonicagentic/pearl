export const REPORTS = [
  {
    slug: "income-statement",
    label: "Income statement",
    description:
      "Cash-basis P&L from categorized activity. Drill any line into Transactions.",
  },
] as const;

export type ReportSlug = (typeof REPORTS)[number]["slug"];

export function isReportSlug(value: string): value is ReportSlug {
  return REPORTS.some((r) => r.slug === value);
}

export function reportHref(
  slug: ReportSlug,
  params?: Record<string, string | undefined>,
) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v);
    }
  }
  const q = qs.toString();
  return q ? `/reports/${slug}?${q}` : `/reports/${slug}`;
}
