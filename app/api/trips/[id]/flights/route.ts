import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/finance/prisma";
import { duffelConfigured, searchFlightsWithFlex } from "@/lib/finance/duffel";
import { ensureTripLegs } from "@/lib/finance/trip-legs-db";
import { duffelSlicesFromLegs } from "@/lib/finance/trips";
import { withOwnerDb } from "@/lib/finance/with-owner";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withOwnerDb(request, async () => {
    const { id } = await params;
    if (!duffelConfigured()) {
      return NextResponse.json(
        {
          error:
            "Add DUFFEL_API_TOKEN to .env to search flights. The rest of the planner still works.",
        },
        { status: 503 },
      );
    }

    await ensureTripLegs(id);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { legs: { orderBy: { sortOrder: "asc" } } },
    });
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    let body: { unitedOnly?: boolean; flexDays?: number } = {};
    try {
      body = (await request.json()) as {
        unitedOnly?: boolean;
        flexDays?: number;
      };
    } catch {
      body = {};
    }

    const flexDays =
      typeof body.flexDays === "number" ? body.flexDays : trip.dateFlexDays;

    let slices = duffelSlicesFromLegs(
      trip.legs.map((l) => ({
        originIata: l.originIata,
        destinationIata: l.destinationIata,
        departureDate: l.departureDate,
      })),
    );

    if (slices.length === 0) {
      const origin = (trip.originIata || "SFO").toUpperCase();
      const destination = (trip.destinationIata || "").toUpperCase();
      if (!destination || !trip.startDate || !trip.endDate) {
        return NextResponse.json(
          {
            error:
              "Add trip legs (or set airports and dates) before searching flights.",
          },
          { status: 400 },
        );
      }
      slices = [
        {
          origin,
          destination,
          departure_date: format(trip.startDate, "yyyy-MM-dd"),
        },
        {
          origin: destination,
          destination: origin,
          departure_date: format(trip.endDate, "yyyy-MM-dd"),
        },
      ];
    }

    try {
      const result = await searchFlightsWithFlex({
        slices: slices.map((s) => ({
          origin: s.origin,
          destination: s.destination,
          departureDate: s.departure_date,
        })),
        flexDays,
        preferredAirline: trip.preferredAirline || "UA",
        unitedOnly: Boolean(body.unitedOnly),
      });
      return NextResponse.json({
        offers: result.offers,
        flexDays: result.flexDays,
        requestCount: result.requestCount,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Flight search failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
