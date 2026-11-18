import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/finance/prisma";
import {
  duffelConfigured,
  geocodeDestination,
  searchStays,
} from "@/lib/finance/duffel";
import { ensureTripLegs } from "@/lib/finance/trip-legs-db";
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
            "Add DUFFEL_API_TOKEN to .env to search stays. The rest of the planner still works.",
        },
        { status: 503 },
      );
    }

    await ensureTripLegs(id);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        home: true,
        legs: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    let body: { flexDays?: number; stopIndex?: number } = {};
    try {
      body = (await request.json()) as {
        flexDays?: number;
        stopIndex?: number;
      };
    } catch {
      body = {};
    }

    const flexDays =
      typeof body.flexDays === "number" ? body.flexDays : trip.dateFlexDays;

    // Multi-city: overnight between leg[stopIndex] arrival and leg[stopIndex+1] departure
    let checkIn: string | null = null;
    let checkOut: string | null = null;
    let query = "";

    if (
      trip.itineraryType === "multi_city" &&
      trip.legs.length >= 2 &&
      typeof body.stopIndex === "number"
    ) {
      const i = body.stopIndex;
      const arrive = trip.legs[i];
      const leave = trip.legs[i + 1];
      if (!arrive?.departureDate || !leave?.departureDate) {
        return NextResponse.json(
          { error: "Set dates on both legs around this stop." },
          { status: 400 },
        );
      }
      checkIn = format(arrive.departureDate, "yyyy-MM-dd");
      checkOut = format(leave.departureDate, "yyyy-MM-dd");
      query =
        arrive.destination ||
        arrive.destinationIata ||
        "";
    } else {
      if (!trip.startDate || !trip.endDate) {
        return NextResponse.json(
          { error: "Set start and end dates before searching stays." },
          { status: 400 },
        );
      }
      checkIn = format(trip.startDate, "yyyy-MM-dd");
      checkOut = format(trip.endDate, "yyyy-MM-dd");
      query =
        trip.destination ||
        [trip.home?.city, trip.home?.region].filter(Boolean).join(", ") ||
        trip.destinationIata ||
        trip.legs[0]?.destination ||
        trip.legs[0]?.destinationIata ||
        "";
    }

    if (!query || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: "Set a destination city (or airport) before searching stays." },
        { status: 400 },
      );
    }

    try {
      const geo = await geocodeDestination(query);
      if (!geo) {
        return NextResponse.json(
          { error: `Could not find a location for “${query}”.` },
          { status: 400 },
        );
      }
      const stays = await searchStays({
        latitude: geo.latitude,
        longitude: geo.longitude,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        flexDays,
      });
      return NextResponse.json({
        stays,
        location: geo.label,
        flexDays,
        checkIn,
        checkOut,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Stay search failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
