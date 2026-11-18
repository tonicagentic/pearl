export type VisionSupplyKind =
  | "contacts"
  | "glasses"
  | "solution"
  | "other";

export type VisionSupplyCadence =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "as_needed";

export const VISION_SUPPLY_KIND_LABELS: Record<VisionSupplyKind, string> = {
  contacts: "Contacts",
  glasses: "Glasses",
  solution: "Solution",
  other: "Other",
};

export const VISION_SUPPLY_CADENCE_LABELS: Record<
  VisionSupplyCadence,
  string
> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Every 6 months",
  annual: "Annual",
  as_needed: "As needed",
};

export const DEFAULT_VISION_SUPPLY_CATEGORY_SLUG = "vision-care";

/** Approximate monthly cost for totals (as_needed counts as 0 recurring). */
export function visionSupplyMonthlyEquivalent(
  amount: number,
  cadence: string,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (cadence === "quarterly") return amount / 3;
  if (cadence === "semi_annual") return amount / 6;
  if (cadence === "annual") return amount / 12;
  if (cadence === "as_needed") return 0;
  return amount;
}

export function billCadenceForVisionSupply(cadence: string): string {
  if (cadence === "quarterly") return "quarterly";
  if (cadence === "semi_annual") return "semi_annual";
  if (cadence === "annual") return "annual";
  if (cadence === "as_needed") return "one_time";
  return "monthly";
}
