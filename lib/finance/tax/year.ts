export type TaxSeason = "original" | "extension" | "planning";

const MIN_YEAR = 2018;

/** Calendar day-of-year style compare using month/day only (local time). */
function md(asOf: Date) {
  return { y: asOf.getFullYear(), m: asOf.getMonth() + 1, d: asOf.getDate() };
}

function onOrBefore(asOf: Date, month: number, day: number) {
  const { m, d } = md(asOf);
  return m < month || (m === month && d <= day);
}

/**
 * Default tax year from filing seasons:
 * - Jan 1 – Oct 15 → prior calendar year (original + extension)
 * - Oct 16 – Dec 31 → current calendar year (planning)
 */
export function defaultTaxYear(asOf: Date = new Date()): number {
  const { y } = md(asOf);
  if (onOrBefore(asOf, 10, 15)) return y - 1;
  return y;
}

export function taxSeason(asOf: Date = new Date()): TaxSeason {
  if (onOrBefore(asOf, 4, 15)) return "original";
  if (onOrBefore(asOf, 10, 15)) return "extension";
  return "planning";
}

export function originalFilingDeadline(taxYear: number): Date {
  return new Date(taxYear + 1, 3, 15);
}

export function extensionFilingDeadline(taxYear: number): Date {
  return new Date(taxYear + 1, 9, 15);
}

export function resolveTaxYear(
  raw: string | number | null | undefined,
  asOf: Date = new Date(),
): number {
  const max = asOf.getFullYear() + 1;
  const parsed =
    typeof raw === "number" ? raw : raw != null && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(parsed)) {
    return Math.min(max, Math.max(MIN_YEAR, Math.trunc(parsed)));
  }
  return defaultTaxYear(asOf);
}

export function listSelectableTaxYears(opts: {
  fromData: number[];
  asOf?: Date;
}): number[] {
  const asOf = opts.asOf ?? new Date();
  const def = defaultTaxYear(asOf);
  const set = new Set<number>([
    def,
    def - 1,
    def + 1,
    asOf.getFullYear(),
    asOf.getFullYear() - 1,
    ...opts.fromData.filter((y) => Number.isFinite(y)),
  ]);
  const max = asOf.getFullYear() + 1;
  return [...set]
    .filter((y) => y >= MIN_YEAR && y <= max)
    .sort((a, b) => b - a);
}

export function seasonLabel(season: TaxSeason): string {
  switch (season) {
    case "original":
      return "Original filing season (through Apr 15)";
    case "extension":
      return "Extension season (through Oct 15)";
    default:
      return "Planning season";
  }
}
