export type PrescriptionCadence = "monthly" | "quarterly" | "as_needed";

export const PRESCRIPTION_CADENCE_LABELS: Record<PrescriptionCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  as_needed: "As needed",
};

export const DEFAULT_PRESCRIPTION_CATEGORY_SLUG = "prescriptions";

/** Approximate monthly cost for totals (as_needed counts as 0 recurring). */
export function prescriptionMonthlyEquivalent(
  amount: number,
  cadence: string,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (cadence === "quarterly") return amount / 3;
  if (cadence === "as_needed") return 0;
  return amount;
}

export function billCadenceForPrescription(cadence: string): string {
  if (cadence === "quarterly") return "quarterly";
  if (cadence === "as_needed") return "one_time";
  return "monthly";
}
