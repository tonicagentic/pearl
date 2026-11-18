import { prisma } from "@/lib/finance/prisma";
import { legacyLegsFromTrip } from "@/lib/finance/trips";

function dateOnlyOrNull(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Ensure a trip has TripLeg rows (backfill from summary fields if needed). */
export async function ensureTripLegs(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { legs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!trip) return null;
  if (trip.legs.length > 0) return trip;

  const legs = legacyLegsFromTrip(trip);
  if (legs.length === 0) return trip;

  await prisma.$transaction(async (tx) => {
    for (const [i, leg] of legs.entries()) {
      await tx.tripLeg.create({
        data: {
          tripId: trip.id,
          sortOrder: i,
          originIata: leg.originIata,
          destinationIata: leg.destinationIata,
          departureDate: leg.departureDate
            ? dateOnlyOrNull(leg.departureDate)
            : null,
          destination: leg.destination ?? null,
        },
      });
    }
  });

  return prisma.trip.findUnique({
    where: { id: tripId },
    include: { legs: { orderBy: { sortOrder: "asc" } } },
  });
}
