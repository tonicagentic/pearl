import { prisma } from "@/lib/finance/prisma";

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export type OwnedHomeLike = {
  id: string;
  name: string;
  occupancy: string;
  estimatedValue: number | null;
  estimatedValueAt: Date | null;
  estimatedValueSource: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
};

export type OwnedVehicleLike = {
  id: string;
  name: string;
  ownership: string;
  year: number | null;
  make: string | null;
  model: string | null;
  estimatedValue: number | null;
  estimatedValueAt: Date | null;
  estimatedValueSource: string | null;
};

async function personalEntityId(): Promise<string | null> {
  const you =
    (await prisma.entity.findFirst({
      where: { taxClass: "individual" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.entity.findUnique({ where: { slug: "you" } }));
  return you?.id ?? null;
}

function homeAssetName(home: OwnedHomeLike): string {
  return home.name;
}

function vehicleAssetName(vehicle: OwnedVehicleLike): string {
  const ymm = [vehicle.year, vehicle.make, vehicle.model]
    .filter((p) => p != null && String(p).trim() !== "")
    .join(" ");
  return ymm || vehicle.name;
}

function valueAsOf(at: Date | null): Date {
  return at ?? new Date();
}

export function homeHasEstimateIdentity(home: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}): boolean {
  const street = [home.addressLine1, home.addressLine2]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  const locality = [home.city, home.region, home.postalCode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  return Boolean(street || locality);
}

export function vehicleHasEstimateIdentity(vehicle: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
}): boolean {
  return Boolean(
    vehicle.year &&
      vehicle.make?.trim() &&
      vehicle.model?.trim(),
  );
}

export function isEstimateStale(estimatedValueAt: Date | null): boolean {
  if (!estimatedValueAt) return true;
  return Date.now() - estimatedValueAt.getTime() > STALE_MS;
}

export async function syncHomeAsset(home: OwnedHomeLike) {
  const existing = await prisma.asset.findUnique({
    where: { homeId: home.id },
  });

  if (home.occupancy !== "own") {
    if (existing) {
      await prisma.asset.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const entityId = existing?.entityId ?? (await personalEntityId());
  if (!entityId) return null;

  const data = {
    entityId,
    homeId: home.id,
    name: homeAssetName(home),
    type: "real_estate",
    value: home.estimatedValue ?? 0,
    valueAsOf: valueAsOf(home.estimatedValueAt),
    notes: home.estimatedValueSource
      ? `Source: ${home.estimatedValueSource}`
      : null,
  };

  if (existing) {
    return prisma.asset.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.asset.create({ data });
}

export async function syncVehicleAsset(vehicle: OwnedVehicleLike) {
  const existing = await prisma.asset.findUnique({
    where: { vehicleId: vehicle.id },
  });

  if (vehicle.ownership !== "own") {
    if (existing) {
      await prisma.asset.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const entityId = existing?.entityId ?? (await personalEntityId());
  if (!entityId) return null;

  const data = {
    entityId,
    vehicleId: vehicle.id,
    name: vehicleAssetName(vehicle),
    type: "vehicle",
    value: vehicle.estimatedValue ?? 0,
    valueAsOf: valueAsOf(vehicle.estimatedValueAt),
    notes: vehicle.estimatedValueSource
      ? `Source: ${vehicle.estimatedValueSource}`
      : null,
  };

  if (existing) {
    return prisma.asset.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.asset.create({ data });
}

export async function removeHomeAsset(homeId: string) {
  await prisma.asset.deleteMany({ where: { homeId } });
}

export async function removeVehicleAsset(vehicleId: string) {
  await prisma.asset.deleteMany({ where: { vehicleId } });
}

/** Ensure every owned home/vehicle has a matching Asset row (and remove stale ones). */
export async function syncAllOwnedAssets() {
  const [homes, vehicles] = await Promise.all([
    prisma.home.findMany({
      select: {
        id: true,
        name: true,
        occupancy: true,
        estimatedValue: true,
        estimatedValueAt: true,
        estimatedValueSource: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        region: true,
        postalCode: true,
      },
    }),
    prisma.vehicle.findMany({
      select: {
        id: true,
        name: true,
        ownership: true,
        year: true,
        make: true,
        model: true,
        estimatedValue: true,
        estimatedValueAt: true,
        estimatedValueSource: true,
      },
    }),
  ]);

  for (const home of homes) {
    await syncHomeAsset(home);
  }
  for (const vehicle of vehicles) {
    await syncVehicleAsset(vehicle);
  }
}

export type OwnedValueRefreshResult = {
  refreshed: number;
  skipped: number;
  failed: { id: string; name: string; kind: "home" | "vehicle"; error: string }[];
};

/**
 * Refresh market values for owned homes/vehicles that are missing a value
 * or whose estimate is older than 30 days. Syncs Asset rows afterward.
 */
export async function refreshStaleOwnedAssetValues(): Promise<OwnedValueRefreshResult> {
  const {
    estimateHomeValue,
    estimateVehicleValue,
    exaConfigured,
    estimatesMissingConfigMessage,
  } = await import("@/lib/finance/exa-estimates");

  if (!exaConfigured()) {
    throw new Error(estimatesMissingConfigMessage());
  }

  const [homes, vehicles] = await Promise.all([
    prisma.home.findMany({ where: { occupancy: "own" } }),
    prisma.vehicle.findMany({ where: { ownership: "own" } }),
  ]);

  const result: OwnedValueRefreshResult = {
    refreshed: 0,
    skipped: 0,
    failed: [],
  };

  for (const home of homes) {
    const needs =
      home.estimatedValue == null || isEstimateStale(home.estimatedValueAt);
    if (!needs) {
      result.skipped += 1;
      continue;
    }
    if (!homeHasEstimateIdentity(home)) {
      result.skipped += 1;
      continue;
    }
    try {
      const estimate = await estimateHomeValue({
        addressLine1: home.addressLine1,
        addressLine2: home.addressLine2,
        city: home.city,
        region: home.region,
        postalCode: home.postalCode,
      });
      const updated = await prisma.home.update({
        where: { id: home.id },
        data: {
          estimatedValue: estimate.estimatedValue,
          estimatedValueSource: estimate.valueSource,
          estimatedValueAt: new Date(),
        },
      });
      await syncHomeAsset(updated);
      result.refreshed += 1;
    } catch (err) {
      result.failed.push({
        id: home.id,
        name: home.name,
        kind: "home",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const vehicle of vehicles) {
    const needs =
      vehicle.estimatedValue == null ||
      isEstimateStale(vehicle.estimatedValueAt);
    if (!needs) {
      result.skipped += 1;
      continue;
    }
    if (!vehicleHasEstimateIdentity(vehicle)) {
      result.skipped += 1;
      continue;
    }
    try {
      const estimate = await estimateVehicleValue({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        city: vehicle.registeredCity,
        region: vehicle.registeredRegion,
      });
      const updated = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          estimatedValue: estimate.estimatedValue,
          estimatedValueSource: estimate.valueSource,
          estimatedValueAt: new Date(),
        },
      });
      await syncVehicleAsset(updated);
      result.refreshed += 1;
    } catch (err) {
      result.failed.push({
        id: vehicle.id,
        name: vehicle.name,
        kind: "vehicle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Refresh every owned home/vehicle that has enough identity for an estimate.
 * Used by the balance-sheet bulk action.
 */
export async function refreshAllOwnedAssetValues(): Promise<OwnedValueRefreshResult> {
  const {
    estimateHomeValue,
    estimateVehicleValue,
    exaConfigured,
    estimatesMissingConfigMessage,
  } = await import("@/lib/finance/exa-estimates");

  if (!exaConfigured()) {
    throw new Error(estimatesMissingConfigMessage());
  }

  const [homes, vehicles] = await Promise.all([
    prisma.home.findMany({ where: { occupancy: "own" } }),
    prisma.vehicle.findMany({ where: { ownership: "own" } }),
  ]);

  const result: OwnedValueRefreshResult = {
    refreshed: 0,
    skipped: 0,
    failed: [],
  };

  for (const home of homes) {
    if (!homeHasEstimateIdentity(home)) {
      result.skipped += 1;
      continue;
    }
    try {
      const estimate = await estimateHomeValue({
        addressLine1: home.addressLine1,
        addressLine2: home.addressLine2,
        city: home.city,
        region: home.region,
        postalCode: home.postalCode,
      });
      const updated = await prisma.home.update({
        where: { id: home.id },
        data: {
          estimatedValue: estimate.estimatedValue,
          estimatedValueSource: estimate.valueSource,
          estimatedValueAt: new Date(),
        },
      });
      await syncHomeAsset(updated);
      result.refreshed += 1;
    } catch (err) {
      result.failed.push({
        id: home.id,
        name: home.name,
        kind: "home",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const vehicle of vehicles) {
    if (!vehicleHasEstimateIdentity(vehicle)) {
      result.skipped += 1;
      continue;
    }
    try {
      const estimate = await estimateVehicleValue({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        city: vehicle.registeredCity,
        region: vehicle.registeredRegion,
      });
      const updated = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          estimatedValue: estimate.estimatedValue,
          estimatedValueSource: estimate.valueSource,
          estimatedValueAt: new Date(),
        },
      });
      await syncVehicleAsset(updated);
      result.refreshed += 1;
    } catch (err) {
      result.failed.push({
        id: vehicle.id,
        name: vehicle.name,
        kind: "vehicle",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/** Try one estimate when an owned record has identity but no value yet. */
export async function maybeEstimateOwnedHomeValue(homeId: string) {
  const {
    estimateHomeValue,
    exaConfigured,
  } = await import("@/lib/finance/exa-estimates");
  if (!exaConfigured()) return;

  const home = await prisma.home.findUnique({ where: { id: homeId } });
  if (!home || home.occupancy !== "own") return;
  if (home.estimatedValue != null) return;
  if (!homeHasEstimateIdentity(home)) return;

  try {
    const estimate = await estimateHomeValue({
      addressLine1: home.addressLine1,
      addressLine2: home.addressLine2,
      city: home.city,
      region: home.region,
      postalCode: home.postalCode,
    });
    const updated = await prisma.home.update({
      where: { id: home.id },
      data: {
        estimatedValue: estimate.estimatedValue,
        estimatedValueSource: estimate.valueSource,
        estimatedValueAt: new Date(),
      },
    });
    await syncHomeAsset(updated);
  } catch {
    /* leave at $0 with no estimate */
  }
}

export async function maybeEstimateOwnedVehicleValue(vehicleId: string) {
  const {
    estimateVehicleValue,
    exaConfigured,
  } = await import("@/lib/finance/exa-estimates");
  if (!exaConfigured()) return;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.ownership !== "own") return;
  if (vehicle.estimatedValue != null) return;
  if (!vehicleHasEstimateIdentity(vehicle)) return;

  try {
    const estimate = await estimateVehicleValue({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      city: vehicle.registeredCity,
      region: vehicle.registeredRegion,
    });
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        estimatedValue: estimate.estimatedValue,
        estimatedValueSource: estimate.valueSource,
        estimatedValueAt: new Date(),
      },
    });
    await syncVehicleAsset(updated);
  } catch {
    /* leave at $0 with no estimate */
  }
}
