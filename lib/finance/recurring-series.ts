import { addDays, addMonths, addWeeks } from "date-fns";
import { defaultAppointmentCategorySlug } from "@/lib/finance/appointments";

export type SeriesDomain = "health" | "lifestyle";

export type SeriesCadence =
  | "weekly"
  | "biweekly"
  | "every_4_weeks"
  | "monthly"
  | "quarterly"
  | "every_6_months"
  | "annual";

export const SERIES_CADENCE_LABELS: Record<SeriesCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  every_4_weeks: "Every 4 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  every_6_months: "Every 6 months",
  annual: "Annual",
};

export const HEALTH_SERIES_KINDS = [
  { value: "therapy", label: "Therapy" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "visit", label: "Visit" },
  { value: "other", label: "Other care" },
] as const;

export const LIFESTYLE_SERIES_KINDS = [
  { value: "hair", label: "Hair" },
  { value: "personal_care", label: "Personal care" },
  { value: "other", label: "Other" },
] as const;

export function defaultSeriesCategorySlug(
  domain: SeriesDomain,
  kind: string,
): string {
  if (domain === "lifestyle") {
    if (kind === "hair") return "hair";
    return "personal-care";
  }
  return defaultAppointmentCategorySlug(kind);
}

/** Approximate monthly cost for budget totals. */
export function seriesMonthlyEquivalent(amount: number, cadence: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "every_4_weeks":
      return (amount * 13) / 12;
    case "quarterly":
      return amount / 3;
    case "every_6_months":
      return amount / 6;
    case "annual":
      return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}

export function billCadenceForSeries(cadence: string): string {
  switch (cadence) {
    case "weekly":
      return "weekly";
    case "quarterly":
      return "quarterly";
    case "every_6_months":
      return "semi_annual";
    case "annual":
      return "annual";
    case "biweekly":
    case "every_4_weeks":
    case "monthly":
    default:
      return "monthly";
  }
}

export function advanceSeriesDate(
  from: Date,
  cadence: string,
): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  switch (cadence) {
    case "weekly":
      return addWeeks(base, 1);
    case "biweekly":
      return addWeeks(base, 2);
    case "every_4_weeks":
      return addWeeks(base, 4);
    case "quarterly":
      return addMonths(base, 3);
    case "every_6_months":
      return addMonths(base, 6);
    case "annual":
      return addMonths(base, 12);
    case "monthly":
    default:
      return addMonths(base, 1);
  }
}

/** Bill amount stored as the per-occurrence pay; monthly bills get monthly-equivalent. */
export function billAmountForSeries(amount: number, cadence: string): number {
  const billCadence = billCadenceForSeries(cadence);
  if (billCadence === "monthly" && cadence !== "monthly") {
    return seriesMonthlyEquivalent(amount, cadence);
  }
  return amount;
}

export function appointmentKindForSeries(
  domain: SeriesDomain,
  kind: string,
): string {
  if (domain === "lifestyle") {
    if (kind === "hair" || kind === "personal_care") return kind;
    return "other";
  }
  return kind || "visit";
}

export function seriesHref(domain: SeriesDomain): string {
  return domain === "lifestyle" ? "/lifestyle#routines" : "/health#routines";
}

export function homeLabelForSeriesKind(kind: string): string {
  if (kind === "hair") return "Hair";
  if (kind === "personal_care") return "Personal care";
  if (kind === "therapy") return "Therapy";
  if (kind === "dental") return "Dental";
  if (kind === "vision") return "Vision";
  if (kind === "visit") return "Visit";
  return "Routine";
}

/** Ensure nextDate is not in the far past when creating the next occurrence. */
export function nextOccurrenceDate(
  nextDate: Date | null | undefined,
  cadence: string,
  today = new Date(),
): Date {
  let d =
    nextDate ??
    new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Cap catch-up so we don't spin forever on very old nextDate.
  for (let i = 0; i < 36 && d < start; i += 1) {
    d = advanceSeriesDate(d, cadence);
  }
  if (d < start) {
    return addDays(start, 0);
  }
  return d;
}
