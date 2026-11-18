import { format } from "date-fns";
import { formatHomeAddress, formatHomeLocality, HOME_LINE_KIND_LABELS } from "@/lib/finance/homes";
import { formatMoney } from "@/lib/finance/money";
import { prisma } from "@/lib/finance/prisma";
import {
  formatVehicleCardDetails,
  formatVehicleTitle,
  monthlyFromPeriodic,
  VEHICLE_LINE_KIND_LABELS,
  VEHICLE_OWNERSHIP_LABELS,
} from "@/lib/finance/vehicles";

function isoDate(d: Date | null | undefined) {
  return d ? format(d, "yyyy-MM-dd") : null;
}

export async function buildHomesListPayload() {
  const homes = await prisma.home.findMany({
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return {
    homes: homes.map((h) => {
      const monthlyPlan = h.lines.reduce(
        (s, l) => s + monthlyFromPeriodic(l.amount, l.cadence),
        0,
      );
      return {
        id: h.id,
        name: h.name,
        occupancy: h.occupancy,
        isPrimary: h.isPrimary,
        city: h.city,
        region: h.region,
        locality: formatHomeLocality(h),
        addressLabel: formatHomeAddress(h),
        estimatedValue: h.estimatedValue,
        estimatedValueLabel:
          h.estimatedValue != null ? formatMoney(h.estimatedValue) : null,
        monthlyPlan,
        monthlyPlanLabel: formatMoney(monthlyPlan),
        lineCount: h.lines.length,
      };
    }),
  };
}

export async function buildHomeDetailPayload(id: string) {
  const home = await prisma.home.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!home) return null;

  const monthlyPlan = home.lines.reduce(
    (s, l) => s + monthlyFromPeriodic(l.amount, l.cadence),
    0,
  );

  return {
    id: home.id,
    name: home.name,
    slug: home.slug,
    occupancy: home.occupancy,
    isPrimary: home.isPrimary,
    addressLine1: home.addressLine1,
    addressLine2: home.addressLine2,
    city: home.city,
    region: home.region,
    postalCode: home.postalCode,
    locality: formatHomeLocality(home),
    addressLabel: formatHomeAddress(home),
    estimatedValue: home.estimatedValue,
    estimatedValueLabel:
      home.estimatedValue != null ? formatMoney(home.estimatedValue) : null,
    estimatedValueSource: home.estimatedValueSource,
    notes: home.notes,
    monthlyPlan,
    monthlyPlanLabel: formatMoney(monthlyPlan),
    lines: home.lines.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      kindLabel:
        HOME_LINE_KIND_LABELS[l.kind as keyof typeof HOME_LINE_KIND_LABELS] ??
        l.kind,
      provider: l.provider,
      amount: l.amount,
      amountLabel: formatMoney(l.amount),
      cadence: l.cadence,
      nextDate: isoDate(l.nextDate),
      monthly: monthlyFromPeriodic(l.amount, l.cadence),
      monthlyLabel: formatMoney(monthlyFromPeriodic(l.amount, l.cadence)),
    })),
  };
}

export type UpdateHomeInput = {
  name?: string;
  occupancy?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  estimatedValue?: number | null;
  notes?: string | null;
  isPrimary?: boolean;
};

export async function updateHomeRecord(id: string, input: UpdateHomeInput) {
  const previous = await prisma.home.findUnique({ where: { id } });
  if (!previous) throw new Error("Home not found");

  if (input.isPrimary) {
    await prisma.home.updateMany({ data: { isPrimary: false } });
  }

  const estimatedValue =
    "estimatedValue" in input ? input.estimatedValue ?? null : previous.estimatedValue;
  const valueChanged =
    "estimatedValue" in input &&
    estimatedValue !== previous.estimatedValue &&
    !(estimatedValue == null && previous.estimatedValue == null);

  const home = await prisma.home.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.occupancy != null ? { occupancy: input.occupancy } : {}),
      ...(input.addressLine1 !== undefined
        ? { addressLine1: input.addressLine1 || null }
        : {}),
      ...(input.addressLine2 !== undefined
        ? { addressLine2: input.addressLine2 || null }
        : {}),
      ...(input.city !== undefined ? { city: input.city || null } : {}),
      ...(input.region !== undefined ? { region: input.region || null } : {}),
      ...(input.postalCode !== undefined
        ? { postalCode: input.postalCode || null }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.isPrimary ? { isPrimary: true } : {}),
      ...("estimatedValue" in input
        ? {
            estimatedValue,
            ...(valueChanged
              ? {
                  estimatedValueSource:
                    estimatedValue != null ? "Entered" : null,
                  estimatedValueAt:
                    estimatedValue != null ? new Date() : null,
                }
              : {}),
          }
        : {}),
    },
  });

  const { syncHomeAsset, maybeEstimateOwnedHomeValue } = await import(
    "@/lib/finance/owned-assets"
  );
  await syncHomeAsset(home);
  if (home.occupancy === "own" && home.estimatedValue == null) {
    await maybeEstimateOwnedHomeValue(home.id);
  }

  return buildHomeDetailPayload(id);
}

export type UpdateHomeLineInput = {
  name?: string;
  provider?: string | null;
  amount?: number;
  cadence?: string;
  nextDate?: string | null;
};

export async function updateHomeLineRecord(
  homeId: string,
  lineId: string,
  input: UpdateHomeLineInput,
) {
  const existing = await prisma.homeLine.findFirst({
    where: { id: lineId, homeId },
  });
  if (!existing) throw new Error("Line not found");

  const name = input.name?.trim() || existing.name;
  const provider =
    input.provider !== undefined ? input.provider || null : existing.provider;
  const amount =
    input.amount !== undefined ? Number(input.amount) || 0 : existing.amount;
  const cadence = input.cadence || existing.cadence;
  const nextDate =
    input.nextDate !== undefined
      ? input.nextDate
        ? new Date(input.nextDate)
        : null
      : existing.nextDate;

  const line = await prisma.homeLine.update({
    where: { id: lineId },
    data: { name, provider, amount, cadence, nextDate },
    include: { home: { select: { name: true } } },
  });

  const { syncHomeLineBill, syncHomeLineBudget } = await import(
    "@/lib/finance/home-line-bills"
  );
  const { currentYearMonth } = await import("@/lib/finance/money");
  const billId = await syncHomeLineBill({
    ...line,
    homeName: line.home.name,
  });
  await prisma.homeLine.update({ where: { id: lineId }, data: { billId } });

  const ym = currentYearMonth();
  await syncHomeLineBudget({
    year: ym.year,
    month: ym.month,
    categoryId: line.categoryId,
    amount,
    cadence,
  });

  return buildHomeDetailPayload(homeId);
}

export async function buildVehiclesListPayload() {
  const vehicles = await prisma.vehicle.findMany({
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });

  return {
    vehicles: vehicles.map((v) => {
      const insuranceMonthly = monthlyFromPeriodic(
        v.insuranceAmount,
        v.insuranceCadence,
      );
      const registrationMonthly = monthlyFromPeriodic(
        v.registrationAmount,
        "annual",
      );
      const fuelMonthly = v.fuelEstimateMonthly ?? 0;
      const monthlyPlan = insuranceMonthly + registrationMonthly + fuelMonthly;
      return {
        id: v.id,
        name: v.name,
        title: formatVehicleTitle(v) || v.name,
        ownership: v.ownership,
        ownershipLabel:
          VEHICLE_OWNERSHIP_LABELS[
            v.ownership as keyof typeof VEHICLE_OWNERSHIP_LABELS
          ] ?? v.ownership,
        details: formatVehicleCardDetails(v),
        estimatedValue: v.estimatedValue,
        estimatedValueLabel:
          v.estimatedValue != null ? formatMoney(v.estimatedValue) : null,
        monthlyPlan,
        monthlyPlanLabel: formatMoney(monthlyPlan),
        lineCount: v.lines.length,
      };
    }),
  };
}

export async function buildVehicleDetailPayload(id: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!vehicle) return null;

  const insuranceMonthly = monthlyFromPeriodic(
    vehicle.insuranceAmount,
    vehicle.insuranceCadence,
  );
  const registrationMonthly = monthlyFromPeriodic(
    vehicle.registrationAmount,
    "annual",
  );
  const fuelMonthly = vehicle.fuelEstimateMonthly ?? 0;

  return {
    id: vehicle.id,
    name: vehicle.name,
    title: formatVehicleTitle(vehicle) || vehicle.name,
    ownership: vehicle.ownership,
    ownershipLabel:
      VEHICLE_OWNERSHIP_LABELS[
        vehicle.ownership as keyof typeof VEHICLE_OWNERSHIP_LABELS
      ] ?? vehicle.ownership,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    estimatedValue: vehicle.estimatedValue,
    estimatedValueLabel:
      vehicle.estimatedValue != null
        ? formatMoney(vehicle.estimatedValue)
        : null,
    milesPerMonth: vehicle.milesPerMonth,
    fuelEstimateMonthly: vehicle.fuelEstimateMonthly,
    fuelEstimateMonthlyLabel:
      vehicle.fuelEstimateMonthly != null
        ? formatMoney(vehicle.fuelEstimateMonthly)
        : null,
    registeredLine1: vehicle.registeredLine1,
    registeredLine2: vehicle.registeredLine2,
    registeredCity: vehicle.registeredCity,
    registeredRegion: vehicle.registeredRegion,
    registrationRenewsOn: isoDate(vehicle.registrationRenewsOn),
    registrationAmount: vehicle.registrationAmount,
    registrationAmountLabel:
      vehicle.registrationAmount != null
        ? formatMoney(vehicle.registrationAmount)
        : null,
    insuranceCarrier: vehicle.insuranceCarrier,
    insurancePolicyNumber: vehicle.insurancePolicyNumber,
    insuranceAmount: vehicle.insuranceAmount,
    insuranceAmountLabel:
      vehicle.insuranceAmount != null
        ? formatMoney(vehicle.insuranceAmount)
        : null,
    insuranceCadence: vehicle.insuranceCadence,
    insuranceRenewsOn: isoDate(vehicle.insuranceRenewsOn),
    notes: vehicle.notes,
    details: formatVehicleCardDetails(vehicle),
    monthlyPlan: insuranceMonthly + registrationMonthly + fuelMonthly,
    monthlyPlanLabel: formatMoney(
      insuranceMonthly + registrationMonthly + fuelMonthly,
    ),
    lines: vehicle.lines.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      kindLabel:
        VEHICLE_LINE_KIND_LABELS[
          l.kind as keyof typeof VEHICLE_LINE_KIND_LABELS
        ] ?? l.kind,
    })),
  };
}

export type UpdateVehicleInput = {
  name?: string;
  ownership?: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  estimatedValue?: number | null;
  milesPerMonth?: number | null;
  registeredLine1?: string | null;
  registeredLine2?: string | null;
  registeredCity?: string | null;
  registeredRegion?: string | null;
  registrationRenewsOn?: string | null;
  registrationAmount?: number | null;
  insuranceCarrier?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceAmount?: number | null;
  insuranceCadence?: string;
  insuranceRenewsOn?: string | null;
  notes?: string | null;
};

export async function updateVehicleRecord(
  id: string,
  input: UpdateVehicleInput,
) {
  const previous = await prisma.vehicle.findUnique({ where: { id } });
  if (!previous) throw new Error("Vehicle not found");

  const estimatedValue =
    "estimatedValue" in input
      ? input.estimatedValue ?? null
      : previous.estimatedValue;
  const valueChanged =
    "estimatedValue" in input &&
    estimatedValue !== previous.estimatedValue &&
    !(estimatedValue == null && previous.estimatedValue == null);

  const parseOptionalDate = (raw: string | null | undefined) => {
    if (raw === undefined) return undefined;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  await prisma.vehicle.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.ownership != null ? { ownership: input.ownership } : {}),
      ...(input.make !== undefined ? { make: input.make || null } : {}),
      ...(input.model !== undefined ? { model: input.model || null } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.milesPerMonth !== undefined
        ? { milesPerMonth: input.milesPerMonth }
        : {}),
      ...(input.registeredLine1 !== undefined
        ? { registeredLine1: input.registeredLine1 || null }
        : {}),
      ...(input.registeredLine2 !== undefined
        ? { registeredLine2: input.registeredLine2 || null }
        : {}),
      ...(input.registeredCity !== undefined
        ? { registeredCity: input.registeredCity || null }
        : {}),
      ...(input.registeredRegion !== undefined
        ? { registeredRegion: input.registeredRegion || null }
        : {}),
      ...(input.registrationAmount !== undefined
        ? { registrationAmount: input.registrationAmount }
        : {}),
      ...(input.registrationRenewsOn !== undefined
        ? {
            registrationRenewsOn: parseOptionalDate(input.registrationRenewsOn),
          }
        : {}),
      ...(input.insuranceCarrier !== undefined
        ? { insuranceCarrier: input.insuranceCarrier || null }
        : {}),
      ...(input.insurancePolicyNumber !== undefined
        ? { insurancePolicyNumber: input.insurancePolicyNumber || null }
        : {}),
      ...(input.insuranceAmount !== undefined
        ? { insuranceAmount: input.insuranceAmount }
        : {}),
      ...(input.insuranceCadence != null
        ? { insuranceCadence: input.insuranceCadence }
        : {}),
      ...(input.insuranceRenewsOn !== undefined
        ? { insuranceRenewsOn: parseOptionalDate(input.insuranceRenewsOn) }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...("estimatedValue" in input
        ? {
            estimatedValue,
            ...(valueChanged
              ? {
                  estimatedValueSource:
                    estimatedValue != null ? "Entered" : null,
                  estimatedValueAt:
                    estimatedValue != null ? new Date() : null,
                }
              : {}),
          }
        : {}),
    },
  });

  const withLines = await prisma.vehicle.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });
  const { syncVehicleBills } = await import("@/lib/finance/vehicle-bills");
  const billIds = await syncVehicleBills(withLines);
  await prisma.vehicle.update({ where: { id }, data: billIds });

  const { syncVehicleAsset, maybeEstimateOwnedVehicleValue } = await import(
    "@/lib/finance/owned-assets"
  );
  await syncVehicleAsset(withLines);
  if (withLines.ownership === "own" && withLines.estimatedValue == null) {
    await maybeEstimateOwnedVehicleValue(id);
  }

  return buildVehicleDetailPayload(id);
}
