import { format } from "date-fns";
import { formatMoney } from "@/lib/finance/money";

export type VehicleOwnership = "own" | "lease" | "borrow";

export type VehicleLineKind =
  | "payment"
  | "insurance"
  | "fuel"
  | "maintenance"
  | "parking"
  | "registration"
  | "other";

export type InsuranceCadence = "monthly" | "semi_annual" | "annual";

export const VEHICLE_OWNERSHIP_LABELS: Record<VehicleOwnership, string> = {
  own: "Own",
  lease: "Lease",
  borrow: "Borrow / family",
};

export const VEHICLE_LINE_KIND_LABELS: Record<VehicleLineKind, string> = {
  payment: "Payment",
  insurance: "Insurance",
  fuel: "Fuel",
  maintenance: "Maintenance",
  parking: "Parking & tolls",
  registration: "Registration",
  other: "Other",
};

export const INSURANCE_CADENCE_LABELS: Record<InsuranceCadence, string> = {
  monthly: "Monthly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

/** Months covered by a premium/registration period. */
export function monthsForCadence(cadence: string | null | undefined): number {
  if (cadence === "quarterly") return 3;
  if (cadence === "semi_annual") return 6;
  if (cadence === "annual") return 12;
  if (cadence === "weekly") return 1 / 4.345;
  return 1;
}

/** Spread a period premium into a monthly cost (e.g. $1,243.88 / 6). */
export function monthlyFromPeriodic(
  amount: number | null | undefined,
  cadence: string | null | undefined = "monthly",
): number {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0;
  const months = monthsForCadence(cadence);
  if (months <= 0) return 0;
  return amount / months;
}

/** Default expense lines when creating a vehicle, by ownership. */
export function defaultVehicleLines(
  ownership: VehicleOwnership,
): { name: string; kind: VehicleLineKind }[] {
  const shared: { name: string; kind: VehicleLineKind }[] = [
    { name: "Insurance", kind: "insurance" },
    { name: "Fuel", kind: "fuel" },
    { name: "Maintenance", kind: "maintenance" },
    { name: "Parking and tolls", kind: "parking" },
    { name: "Registration", kind: "registration" },
  ];
  if (ownership === "borrow") {
    return shared;
  }
  return [
    {
      name: ownership === "lease" ? "Lease payment" : "Car payment",
      kind: "payment",
    },
    ...shared,
  ];
}

export function slugifyVehicle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function formatVehicleTitle(vehicle: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string | null {
  const ymm = [vehicle.year, vehicle.make?.trim(), vehicle.model?.trim()]
    .filter(Boolean)
    .join(" ");
  return ymm || null;
}

export function formatVehicleRegistration(vehicle: {
  registeredLine1?: string | null;
  registeredLine2?: string | null;
  registeredCity?: string | null;
  registeredRegion?: string | null;
}): string | null {
  const line1 = vehicle.registeredLine1?.trim() || "";
  const line2 = vehicle.registeredLine2?.trim() || "";
  const street = [line1, line2]
    .filter(Boolean)
    .join(line2.startsWith("#") ? " " : ", ");

  const city = vehicle.registeredCity?.trim() || "";
  const region = vehicle.registeredRegion?.trim() || "";
  let locality = "";
  if (city && region) locality = `${city}, ${region}`;
  else locality = city || region;

  const parts = [street || null, locality || null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function formatVehicleCardDetails(vehicle: {
  estimatedValue?: number | null;
  registrationRenewsOn?: Date | string | null;
  insuranceCarrier?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceAmount?: number | null;
  insuranceCadence?: string | null;
}): string | null {
  const parts: string[] = [];
  if (
    vehicle.estimatedValue != null &&
    Number.isFinite(vehicle.estimatedValue)
  ) {
    parts.push(`Value ${formatMoney(vehicle.estimatedValue)}`);
  }
  if (vehicle.registrationRenewsOn) {
    const d =
      vehicle.registrationRenewsOn instanceof Date
        ? vehicle.registrationRenewsOn
        : new Date(vehicle.registrationRenewsOn);
    if (!Number.isNaN(d.getTime())) {
      parts.push(`Reg renews ${format(d, "MMM d, yyyy")}`);
    }
  }
  const carrier = vehicle.insuranceCarrier?.trim();
  const policy = vehicle.insurancePolicyNumber?.trim();
  if (carrier || policy) {
    const periodShort: Record<string, string> = {
      monthly: "mo",
      semi_annual: "6mo",
      annual: "yr",
    };
    const period =
      periodShort[vehicle.insuranceCadence ?? ""] ?? vehicle.insuranceCadence;
    const premium =
      vehicle.insuranceAmount != null && Number.isFinite(vehicle.insuranceAmount)
        ? `${formatMoney(vehicle.insuranceAmount)}${period ? `/${period}` : ""}`
        : null;
    parts.push(
      [carrier || "Insurance", policy ? `#${policy}` : null, premium]
        .filter(Boolean)
        .join(" "),
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

export function vehicleDisplayName(vehicle: {
  name: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): string {
  return formatVehicleTitle(vehicle) || vehicle.name;
}
