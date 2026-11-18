export type HealthCoverageType = "medical" | "dental" | "vision";

export type EnrollmentKind = "open" | "special";

export type QualifyingEvent =
  | "lost_coverage"
  | "household_change"
  | "move"
  | "medicaid_chip"
  | "employer_change"
  | "other";

export const HEALTH_COVERAGE_LABELS: Record<HealthCoverageType, string> = {
  medical: "Medical",
  dental: "Dental",
  vision: "Vision",
};

export const ENROLLMENT_KIND_LABELS: Record<EnrollmentKind, string> = {
  open: "Open enrollment",
  special: "Special enrollment",
};

export const QUALIFYING_EVENT_LABELS: Record<QualifyingEvent, string> = {
  lost_coverage: "Lost other coverage",
  household_change: "Household change (marriage, birth, adoption)",
  move: "Move",
  medicaid_chip: "Medicaid or CHIP",
  employer_change: "Employer plan change",
  other: "Other",
};

export const HEALTH_METAL_TIERS = [
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
  { value: "catastrophic", label: "Catastrophic" },
  { value: "other", label: "Other" },
] as const;

export type CoverageWindow = {
  year: number;
  coverageStart?: Date | null;
  coverageEnd?: Date | null;
};

/** Effective coverage window: blank dates mean full calendar year. */
export function effectiveCoverageWindow(plan: CoverageWindow): {
  start: Date;
  end: Date;
} {
  return {
    start: plan.coverageStart ?? new Date(plan.year, 0, 1),
    end: plan.coverageEnd ?? new Date(plan.year, 11, 31),
  };
}

/** Months of coverage overlapping a calendar year (1–12). */
export function monthsCovered(
  year: number,
  coverageStart?: Date | null,
  coverageEnd?: Date | null,
): number {
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year, 11, 31);
  const from = coverageStart && coverageStart > yStart ? coverageStart : yStart;
  const to = coverageEnd && coverageEnd < yEnd ? coverageEnd : yEnd;
  if (to < from) return 0;
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1;
  return Math.min(12, Math.max(0, months));
}

/** Premium counted inside a specific calendar year (for tax / budget). */
export function premiumInYear(
  plan: {
    year: number;
    premiumMonthly: number;
    coverageStart?: Date | null;
    coverageEnd?: Date | null;
  },
  calendarYear: number,
): number {
  const { start, end } = effectiveCoverageWindow(plan);
  return plan.premiumMonthly * monthsCovered(calendarYear, start, end);
}

export function annualPremium(plan: {
  year: number;
  premiumMonthly: number;
  coverageStart?: Date | null;
  coverageEnd?: Date | null;
}): number {
  return premiumInYear(plan, plan.year);
}

/** True when the plan’s coverage window overlaps the calendar year. */
export function planOverlapsYear(
  plan: CoverageWindow,
  calendarYear: number,
): boolean {
  const { start, end } = effectiveCoverageWindow(plan);
  const yStart = new Date(calendarYear, 0, 1);
  const yEnd = new Date(calendarYear, 11, 31, 23, 59, 59, 999);
  return start <= yEnd && end >= yStart;
}

/** True when `on` falls inside the plan’s coverage period. */
export function planCoversDate(
  plan: CoverageWindow,
  on: Date,
): boolean {
  const { start, end } = effectiveCoverageWindow(plan);
  const day = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return day >= s && day <= e;
}

export function defaultOpenEnrollmentDates(year: number): {
  coverageStart: Date;
  coverageEnd: Date;
} {
  return {
    coverageStart: new Date(year, 0, 1),
    coverageEnd: new Date(year, 11, 31),
  };
}

/** Default CoA slug for a coverage type — reuse existing categories. */
export function defaultCategorySlug(coverageType: HealthCoverageType): string {
  if (coverageType === "dental") return "dental-insurance";
  if (coverageType === "vision") return "vision-insurance";
  return "health-insurance";
}

export type PlanDraftFields = {
  coverageType: string;
  carrier: string;
  planName: string;
  metalTier: string | null;
  premiumMonthly: number;
  hsaEligible: boolean;
  categoryId: string;
};

/** Fields safe to copy into next year’s unconfirmed draft. */
export function draftFieldsFromPlan(plan: PlanDraftFields): PlanDraftFields {
  return {
    coverageType: plan.coverageType,
    carrier: plan.carrier,
    planName: plan.planName,
    metalTier: plan.metalTier,
    premiumMonthly: plan.premiumMonthly,
    hsaEligible: plan.hsaEligible,
    categoryId: plan.categoryId,
  };
}
