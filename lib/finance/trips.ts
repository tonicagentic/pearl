export type TripStatus = "idea" | "planning" | "booked" | "done" | "cancelled";

export type TripLineKind =
  | "flights"
  | "lodging"
  | "food"
  | "activities"
  | "transport"
  | "other";

export type TripBookingStatus =
  | "todo"
  | "chosen"
  | "booked"
  | "paid"
  | "not_needed";

export type TripStayMode = "own_home" | "friend" | "book";

export type TripOptionKind = "flight" | "lodging";

export type TripItineraryType = "round_trip" | "multi_city";

export type TripDayItemKind = "person" | "event" | "activity";

export const TRIP_DAY_ITEM_KIND_LABELS: Record<TripDayItemKind, string> = {
  person: "Seeing",
  event: "Event",
  activity: "Activity",
};

export type TripLegInput = {
  originIata: string;
  destinationIata: string;
  departureDate: string | null; // yyyy-MM-dd
  destination?: string | null;
  stayMode?: string | null;
  homeId?: string | null;
  hostName?: string | null;
};

export const TRIP_ITINERARY_LABELS: Record<TripItineraryType, string> = {
  round_trip: "Round trip",
  multi_city: "Multi-city",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  idea: "Idea",
  planning: "Planning",
  booked: "Booked",
  done: "Done",
  cancelled: "Cancelled",
};

export const TRIP_LINE_KIND_LABELS: Record<TripLineKind, string> = {
  flights: "Flights",
  lodging: "Lodging",
  food: "Food & local",
  activities: "Activities",
  transport: "Transport",
  other: "Other",
};

export const TRIP_BOOKING_STATUS_LABELS: Record<TripBookingStatus, string> = {
  todo: "To book",
  chosen: "Chosen",
  booked: "Booked",
  paid: "Paid",
  not_needed: "Not needed",
};

export const TRIP_STAY_MODE_LABELS: Record<TripStayMode, string> = {
  own_home: "My place",
  friend: "With a friend",
  book: "Book a place",
};

/** Default trip lines → existing Travel CoA slugs. */
export function defaultTripLines(): {
  name: string;
  kind: TripLineKind;
  categorySlug: string;
}[] {
  return [
    { name: "Flights", kind: "flights", categorySlug: "flights" },
    { name: "Lodging", kind: "lodging", categorySlug: "lodging" },
    { name: "Food & local", kind: "food", categorySlug: "trip-food" },
    { name: "Activities", kind: "activities", categorySlug: "travel-activities" },
  ];
}

export function categorySlugForKind(kind: TripLineKind): string {
  switch (kind) {
    case "flights":
      return "flights";
    case "lodging":
      return "lodging";
    case "food":
      return "trip-food";
    case "activities":
      return "travel-activities";
    case "transport":
      return "rideshare";
    default:
      return "travel-activities";
  }
}

export function slugifyTrip(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function plannedTotal(
  lines: { plannedAmount: number }[],
): number {
  return lines.reduce((s, l) => s + l.plannedAmount, 0);
}

export function unbookedCount(
  lines: { bookingStatus: string }[],
): number {
  return lines.filter(
    (l) => l.bookingStatus === "todo" || l.bookingStatus === "chosen",
  ).length;
}

/** Start of today in local time. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isUpcomingTrip(trip: {
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}): boolean {
  if (trip.status === "cancelled" || trip.status === "done") return false;
  const today = startOfToday();
  if (trip.endDate && trip.endDate < today) return false;
  if (trip.status === "planning" || trip.status === "booked") return true;
  if (trip.startDate && trip.startDate >= today) return true;
  return false;
}

export function isIdeaTrip(trip: {
  status: string;
  startDate: Date | null;
}): boolean {
  if (trip.status === "idea") return true;
  if (trip.status === "planning" && !trip.startDate) return true;
  return false;
}

export function isPastTrip(trip: {
  status: string;
  endDate: Date | null;
  startDate: Date | null;
}): boolean {
  if (trip.status === "done" || trip.status === "cancelled") return true;
  const today = startOfToday();
  if (trip.endDate && trip.endDate < today) return true;
  if (!trip.endDate && trip.startDate && trip.startDate < today && trip.status !== "planning") {
    return true;
  }
  return false;
}

export function daysUntil(startDate: Date | null): number | null {
  if (!startDate) return null;
  const today = startOfToday();
  const ms = startDate.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function nightsBetween(
  startDate: Date | null,
  endDate: Date | null,
): number | null {
  if (!startDate || !endDate) return null;
  const ms = endDate.getTime() - startDate.getTime();
  if (ms < 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function stayLabel(trip: {
  stayMode: string | null;
  hostName: string | null;
  home?: { name: string } | null;
}): string {
  if (trip.stayMode === "own_home") {
    return trip.home?.name ? `My place · ${trip.home.name}` : "My place";
  }
  if (trip.stayMode === "friend") {
    return trip.hostName ? `With ${trip.hostName}` : "With a friend";
  }
  if (trip.stayMode === "book") return "Book a place";
  return "Stay TBD";
}

/** Pure stay-mode → lodging line mutation rules (no DB). */
export function lodgingLineForStayMode(stayMode: TripStayMode): {
  plannedAmount: number;
  bookingStatus: TripBookingStatus;
  clearSelectedLodging: boolean;
} {
  if (stayMode === "own_home" || stayMode === "friend") {
    return {
      plannedAmount: 0,
      bookingStatus: "not_needed",
      clearSelectedLodging: true,
    };
  }
  return {
    plannedAmount: 0,
    bookingStatus: "todo",
    clearSelectedLodging: false,
  };
}

export type FlightOfferSortable = {
  totalAmount: number;
  segments: { marketingCarrier: string; operatingCarrier?: string | null }[];
};

function unitedRank(offer: FlightOfferSortable, preferred = "UA"): number {
  const codes = offer.segments.map((s) =>
    (s.operatingCarrier || s.marketingCarrier || "").toUpperCase(),
  );
  if (codes.length === 0) return 2;
  if (codes.every((c) => c === preferred)) return 0;
  if (codes.some((c) => c === preferred)) return 1;
  return 2;
}

/** United itineraries first (all-UA, then any-UA), then others; cheapest within each group. */
export function sortFlightOffersUnitedFirst<T extends FlightOfferSortable>(
  offers: T[],
  preferredAirline = "UA",
): T[] {
  return [...offers].sort((a, b) => {
    const ra = unitedRank(a, preferredAirline);
    const rb = unitedRank(b, preferredAirline);
    if (ra !== rb) return ra - rb;
    return a.totalAmount - b.totalAmount;
  });
}

export function isUnitedOffer(
  offer: FlightOfferSortable,
  preferred = "UA",
): boolean {
  return unitedRank(offer, preferred) === 0;
}

export function hasUnitedSegment(
  offer: FlightOfferSortable,
  preferred = "UA",
): boolean {
  return unitedRank(offer, preferred) <= 1;
}

export function autoTripName(legs: { destination?: string | null; destinationIata: string }[]): string {
  const cities = legs
    .map((l) => (l.destination || l.destinationIata || "").trim())
    .filter(Boolean);
  // Drop final return-home city if it duplicates origin-only return
  const unique = [...new Set(cities)];
  if (unique.length === 0) return "New trip";
  if (unique.length === 1) return unique[0]!;
  return unique.slice(0, 3).join(" · ");
}

export function legsPathLabel(
  legs: { originIata: string; destinationIata: string }[],
): string {
  if (legs.length === 0) return "Flights TBD";
  const parts = [legs[0]!.originIata];
  for (const leg of legs) {
    parts.push(leg.destinationIata);
  }
  return parts.join("→");
}

/** Derive Trip summary fields from ordered legs. */
export function summaryFromLegs(legs: TripLegInput[]): {
  originIata: string | null;
  destinationIata: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
} {
  if (legs.length === 0) {
    return {
      originIata: null,
      destinationIata: null,
      destination: null,
      startDate: null,
      endDate: null,
    };
  }
  const first = legs[0]!;
  const last = legs[legs.length - 1]!;
  // For round trip (2 legs returning home), destination is first stop
  const destLeg =
    legs.length >= 2 &&
    last.destinationIata.toUpperCase() === first.originIata.toUpperCase()
      ? legs[0]!
      : last;
  return {
    originIata: first.originIata.toUpperCase(),
    destinationIata: destLeg.destinationIata.toUpperCase(),
    destination: destLeg.destination || destLeg.destinationIata || null,
    startDate: first.departureDate,
    endDate: last.departureDate,
  };
}

/** Round-trip legs from origin/dest + dates. */
export function roundTripLegs(input: {
  originIata: string;
  destinationIata: string;
  destination?: string | null;
  startDate: string;
  endDate: string;
}): TripLegInput[] {
  const origin = input.originIata.toUpperCase();
  const dest = input.destinationIata.toUpperCase();
  return [
    {
      originIata: origin,
      destinationIata: dest,
      departureDate: input.startDate,
      destination: input.destination ?? null,
    },
    {
      originIata: dest,
      destinationIata: origin,
      departureDate: input.endDate,
      destination: null,
    },
  ];
}

/** Backfill legs for a legacy trip that has airports/dates but no legs. */
export function legacyLegsFromTrip(trip: {
  originIata: string | null;
  destinationIata: string | null;
  destination: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
}): TripLegInput[] {
  const origin = (trip.originIata || "SFO").toUpperCase();
  const dest = (trip.destinationIata || "").toUpperCase();
  if (!dest) return [];
  const start =
    trip.startDate instanceof Date
      ? trip.startDate.toISOString().slice(0, 10)
      : trip.startDate
        ? String(trip.startDate).slice(0, 10)
        : null;
  const end =
    trip.endDate instanceof Date
      ? trip.endDate.toISOString().slice(0, 10)
      : trip.endDate
        ? String(trip.endDate).slice(0, 10)
        : null;
  if (!start || !end) return [];
  return roundTripLegs({
    originIata: origin,
    destinationIata: dest,
    destination: trip.destination,
    startDate: start,
    endDate: end,
  });
}

export function duffelSlicesFromLegs(
  legs: {
    originIata: string;
    destinationIata: string;
    departureDate: string | Date | null;
  }[],
): { origin: string; destination: string; departure_date: string }[] {
  return legs
    .filter((l) => l.departureDate)
    .map((l) => {
      const d =
        l.departureDate instanceof Date
          ? l.departureDate.toISOString().slice(0, 10)
          : String(l.departureDate).slice(0, 10);
      return {
        origin: l.originIata.toUpperCase(),
        destination: l.destinationIata.toUpperCase(),
        departure_date: d,
      };
    });
}
