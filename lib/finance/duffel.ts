import { sortFlightOffersUnitedFirst } from "@/lib/finance/trips";
import {
  flexMultiCityDateCombos,
  flexRoundTripPairs,
  flexStayWindows,
} from "@/lib/finance/trip-dates";
import {
  filterStaticHubs,
  mapAndRankDuffelPlaces,
  type DuffelPlaceRaw,
  type PlaceSuggestion,
} from "@/lib/finance/places";

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

export function duffelConfigured(): boolean {
  return Boolean(process.env.DUFFEL_API_TOKEN?.trim());
}

function token(): string {
  const t = process.env.DUFFEL_API_TOKEN?.trim();
  if (!t) throw new Error("DUFFEL_API_TOKEN is not set");
  return t;
}

async function duffelFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${DUFFEL_BASE}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, v);
    }
  }
  const { query: _q, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      "Duffel-Version": DUFFEL_VERSION,
      Authorization: `Bearer ${token()}`,
      ...(rest.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: { title?: string; message?: string; code?: string }[];
  };
  if (!res.ok) {
    const err = body.errors?.[0];
    throw new Error(
      err?.message || err?.title || `Duffel ${res.status}: ${path}`,
    );
  }
  return body.data as T;
}

export type FlightSegmentDto = {
  marketingCarrier: string;
  operatingCarrier: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  departingAt: string;
  arrivingAt: string;
  duration: string | null;
};

export type FlightSliceDto = {
  origin: string;
  destination: string;
  duration: string | null;
  stops: number;
  segments: FlightSegmentDto[];
};

export type FlightOfferDto = {
  id: string;
  totalAmount: number;
  totalCurrency: string;
  cabinClass: string | null;
  expiresAt: string | null;
  ownerAirline: string | null;
  slices: FlightSliceDto[];
  segments: FlightSegmentDto[];
  summary: string;
  /** Departure dates used for this offer request (yyyy-MM-dd per slice). */
  searchedDates?: string[];
  dateLabel?: string | null;
};

type DuffelPlace = {
  iata_code?: string | null;
  name?: string | null;
  city_name?: string | null;
};

type DuffelCarrier = {
  iata_code?: string | null;
  name?: string | null;
};

type DuffelSegment = {
  marketing_carrier?: DuffelCarrier | null;
  operating_carrier?: DuffelCarrier | null;
  marketing_carrier_flight_number?: string | null;
  origin?: DuffelPlace | null;
  destination?: DuffelPlace | null;
  departing_at?: string | null;
  arriving_at?: string | null;
  duration?: string | null;
};

type DuffelSlice = {
  origin?: DuffelPlace | null;
  destination?: DuffelPlace | null;
  duration?: string | null;
  segments?: DuffelSegment[] | null;
};

type DuffelOfferPassenger = {
  id: string;
  type?: string | null;
  given_name?: string | null;
  family_name?: string | null;
};

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string | null;
  cabin_class?: string | null;
  owner?: DuffelCarrier | null;
  slices?: DuffelSlice[] | null;
  passengers?: DuffelOfferPassenger[] | null;
  available_services?:
    | {
        id?: string;
        quantity?: number | null;
        total_amount?: string | null;
        total_currency?: string | null;
        type?: string | null;
      }[]
    | null;
  /** Present after pricing with a card */
  intended_payment_methods?: {
    type?: string;
    card_id?: string;
    charge_amount?: string;
    charge_currency?: string;
    surcharge_amount?: string | null;
    surcharge_currency?: string | null;
  }[] | null;
  intended_services?: { id: string; quantity: number }[] | null;
};

type DuffelOrder = {
  id: string;
  booking_reference?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
  documents?: { unique_identifier?: string | null; type?: string | null }[] | null;
};

export type FlightOrderPassenger = {
  givenName: string;
  familyName: string;
  bornOn: string; // yyyy-MM-dd
  email: string;
  phoneNumber: string;
  gender: "m" | "f";
  title?: "mr" | "ms" | "mrs" | "miss" | "dr";
};

export type FlightOrderService = {
  id: string;
  quantity: number;
};

export type FlightOrderPayment =
  | {
      type: "balance";
      amount: string;
      currency: string;
    }
  | {
      type: "card";
      amount: string;
      currency: string;
      threeDSecureSessionId: string;
    };

export type FlightOrderResult = {
  orderId: string;
  bookingReference: string;
  totalAmount: number;
  totalCurrency: string;
  offerId: string;
  raw: unknown;
};

export type PricedOfferPaymentMethod = {
  type: "card";
  cardId: string;
  chargeAmount: string;
  chargeCurrency: string;
  surchargeAmount: string | null;
  surchargeCurrency: string | null;
};

type DuffelOfferRequest = {
  id: string;
  offers?: DuffelOffer[] | null;
};

function placeCode(p?: DuffelPlace | null): string {
  return (p?.iata_code || p?.city_name || p?.name || "?").toUpperCase();
}

function mapSegment(s: DuffelSegment): FlightSegmentDto {
  const marketing = (s.marketing_carrier?.iata_code || "?").toUpperCase();
  const operating = s.operating_carrier?.iata_code
    ? s.operating_carrier.iata_code.toUpperCase()
    : null;
  const num = s.marketing_carrier_flight_number || "";
  return {
    marketingCarrier: marketing,
    operatingCarrier: operating,
    flightNumber: `${marketing}${num}`,
    origin: placeCode(s.origin),
    destination: placeCode(s.destination),
    departingAt: s.departing_at || "",
    arrivingAt: s.arriving_at || "",
    duration: s.duration ?? null,
  };
}

function mapOffer(o: DuffelOffer): FlightOfferDto {
  const slices: FlightSliceDto[] = (o.slices ?? []).map((sl) => {
    const segments = (sl.segments ?? []).map(mapSegment);
    return {
      origin: placeCode(sl.origin) || segments[0]?.origin || "?",
      destination:
        placeCode(sl.destination) ||
        segments[segments.length - 1]?.destination ||
        "?",
      duration: sl.duration ?? null,
      stops: Math.max(0, segments.length - 1),
      segments,
    };
  });
  const segments = slices.flatMap((sl) => sl.segments);
  const amount = Number.parseFloat(o.total_amount);
  const owner = o.owner?.iata_code?.toUpperCase() ?? null;
  const outbound = slices[0];
  const ret = slices[1];
  const flightNums = segments.map((s) => s.flightNumber).join(", ");
  const summaryParts = [
    owner || segments[0]?.marketingCarrier || "Flight",
    outbound
      ? `${outbound.origin}→${outbound.destination}${outbound.stops ? ` (${outbound.stops} stop${outbound.stops === 1 ? "" : "s"})` : " nonstop"}`
      : null,
    ret
      ? `return ${ret.origin}→${ret.destination}${ret.stops ? ` (${ret.stops} stop${ret.stops === 1 ? "" : "s"})` : " nonstop"}`
      : null,
    flightNums || null,
  ].filter(Boolean);
  return {
    id: o.id,
    totalAmount: Number.isFinite(amount) ? amount : 0,
    totalCurrency: o.total_currency || "USD",
    cabinClass: o.cabin_class ?? null,
    expiresAt: o.expires_at ?? null,
    ownerAirline: owner,
    slices,
    segments,
    summary: summaryParts.join(" · "),
  };
}

export type FlightSliceInput = {
  origin: string;
  destination: string;
  departureDate: string;
};

function passengerPayload(): Record<string, unknown> {
  const passenger: Record<string, unknown> = { type: "adult" };
  const mileagePlus = process.env.UNITED_MILEAGEPLUS_NUMBER?.trim();
  if (mileagePlus) {
    passenger.loyalty_programme_accounts = [
      { airline_iata_code: "UA", account_number: mileagePlus },
    ];
  }
  return passenger;
}

async function searchOneOfferRequest(input: {
  slices: FlightSliceInput[];
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
}): Promise<FlightOfferDto[]> {
  const data = await duffelFetch<DuffelOfferRequest>("/air/offer_requests", {
    method: "POST",
    query: {
      return_offers: "true",
      supplier_timeout: "12000",
    },
    body: JSON.stringify({
      data: {
        slices: input.slices.map((s) => ({
          origin: s.origin.toUpperCase(),
          destination: s.destination.toUpperCase(),
          departure_date: s.departureDate,
        })),
        passengers: [passengerPayload()],
        cabin_class: input.cabinClass ?? "economy",
        max_connections: 1,
      },
    }),
  });
  const dates = input.slices.map((s) => s.departureDate);
  const dateLabel =
    dates.length === 2
      ? `${dates[0]} → ${dates[1]}`
      : dates.length > 2
        ? dates.join(" · ")
        : dates[0] ?? null;
  return (data.offers ?? []).map((o) => {
    const mapped = mapOffer(o);
    return { ...mapped, searchedDates: dates, dateLabel };
  });
}

function dedupeOffers(offers: FlightOfferDto[]): FlightOfferDto[] {
  const seen = new Set<string>();
  const out: FlightOfferDto[] = [];
  for (const o of offers) {
    const key =
      o.id ||
      `${o.totalAmount}|${o.segments.map((s) => s.flightNumber + s.departingAt).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

/** Search flights for fixed slices (one Duffel offer request). */
export async function searchFlights(input: {
  slices: FlightSliceInput[];
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  preferredAirline?: string;
  unitedOnly?: boolean;
  maxResults?: number;
}): Promise<FlightOfferDto[]> {
  const preferred = (input.preferredAirline || "UA").toUpperCase();
  let offers = await searchOneOfferRequest(input);
  offers = sortFlightOffersUnitedFirst(offers, preferred);
  if (input.unitedOnly) {
    offers = offers.filter((o) =>
      o.segments.every(
        (s) =>
          (s.operatingCarrier || s.marketingCarrier).toUpperCase() ===
          preferred,
      ),
    );
  }
  return offers.slice(0, input.maxResults ?? 40);
}

/**
 * Expand ±flex date windows into up to 25 offer requests, merge, United-first.
 * Round trip: expand both dates. Multi-city (3+ slices): expand first & last only.
 */
export async function searchFlightsWithFlex(input: {
  slices: FlightSliceInput[];
  flexDays?: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  preferredAirline?: string;
  unitedOnly?: boolean;
  maxResults?: number;
  maxRequests?: number;
}): Promise<{ offers: FlightOfferDto[]; requestCount: number; flexDays: number }> {
  const flex = Math.max(0, input.flexDays ?? 0);
  const maxRequests = input.maxRequests ?? 25;
  const preferred = (input.preferredAirline || "UA").toUpperCase();

  const base = input.slices.map((s) => ({
    origin: s.origin.toUpperCase(),
    destination: s.destination.toUpperCase(),
    departureDate: s.departureDate,
  }));

  let combos: FlightSliceInput[][] = [base];
  if (flex > 0 && base.length === 2) {
    const pairs = flexRoundTripPairs(
      base[0]!.departureDate,
      base[1]!.departureDate,
      flex,
      maxRequests,
    );
    combos = pairs.map((p) => [
      { ...base[0]!, departureDate: p.out },
      { ...base[1]!, departureDate: p.ret },
    ]);
  } else if (flex > 0 && base.length >= 3) {
    const dateCombos = flexMultiCityDateCombos(
      base.map((s) => s.departureDate),
      flex,
      maxRequests,
    );
    combos = dateCombos.map((dates) =>
      base.map((s, i) => ({ ...s, departureDate: dates[i]! })),
    );
  } else if (flex > 0 && base.length === 1) {
    const { daysAround } = await import("@/lib/finance/trip-dates");
    combos = daysAround(base[0]!.departureDate, flex)
      .slice(0, maxRequests)
      .map((d) => [{ ...base[0]!, departureDate: d }]);
  }

  const settled = await Promise.allSettled(
    combos.map((slices) =>
      searchOneOfferRequest({ slices, cabinClass: input.cabinClass }),
    ),
  );

  let offers: FlightOfferDto[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") offers.push(...r.value);
  }
  offers = dedupeOffers(offers);
  offers = sortFlightOffersUnitedFirst(offers, preferred);
  if (input.unitedOnly) {
    offers = offers.filter((o) =>
      o.segments.every(
        (s) =>
          (s.operatingCarrier || s.marketingCarrier).toUpperCase() ===
          preferred,
      ),
    );
  }

  return {
    offers: offers.slice(0, input.maxResults ?? 60),
    requestCount: combos.length,
    flexDays: flex,
  };
}

export async function searchRoundTripFlights(input: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  preferredAirline?: string;
  unitedOnly?: boolean;
  maxResults?: number;
  flexDays?: number;
}): Promise<FlightOfferDto[]> {
  const result = await searchFlightsWithFlex({
    slices: [
      {
        origin: input.origin,
        destination: input.destination,
        departureDate: input.departureDate,
      },
      {
        origin: input.destination,
        destination: input.origin,
        departureDate: input.returnDate,
      },
    ],
    flexDays: input.flexDays ?? 0,
    cabinClass: input.cabinClass,
    preferredAirline: input.preferredAirline,
    unitedOnly: input.unitedOnly,
    maxResults: input.maxResults,
  });
  return result.offers;
}

export type StayResultDto = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  freeCancellation: boolean | null;
  rating: number | null;
  accommodationId: string | null;
  checkInDate: string;
  checkOutDate: string;
  summary: string;
  locationHint: string | null;
};

type DuffelStaySearchResult = {
  id: string;
  check_in_date?: string;
  check_out_date?: string;
  cheapest_rate_total_amount?: string | null;
  cheapest_rate_currency?: string | null;
  cheapest_rate_free_cancellation?: boolean | null;
  accommodation?: {
    id?: string;
    name?: string | null;
    rating?: number | null;
    location?: {
      geographic_coordinates?: { latitude?: number; longitude?: number } | null;
      address?: {
        city_name?: string | null;
        region?: string | null;
        line_one?: string | null;
      } | null;
    } | null;
  } | null;
};

export type GeoPoint = { latitude: number; longitude: number; label: string };

/** Geocode a free-text place via Open-Meteo (no API key). */
export async function geocodeDestination(
  query: string,
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: {
      name?: string;
      admin1?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
    }[];
  };
  const hit = json.results?.[0];
  if (
    !hit ||
    typeof hit.latitude !== "number" ||
    typeof hit.longitude !== "number"
  ) {
    return null;
  }
  const label = [hit.name, hit.admin1, hit.country_code]
    .filter(Boolean)
    .join(", ");
  return { latitude: hit.latitude, longitude: hit.longitude, label };
}

async function searchStaysOnce(input: {
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  radiusKm?: number;
}): Promise<StayResultDto[]> {
  const results = await duffelFetch<DuffelStaySearchResult[]>("/stays/search", {
    method: "POST",
    body: JSON.stringify({
      data: {
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        rooms: 1,
        guests: [{ type: "adult" }],
        location: {
          radius: input.radiusKm ?? 10,
          geographic_coordinates: {
            latitude: input.latitude,
            longitude: input.longitude,
          },
        },
      },
    }),
  });

  return (results ?? []).map((r): StayResultDto => {
    const amount = Number.parseFloat(r.cheapest_rate_total_amount || "0");
    const currency = r.cheapest_rate_currency || "USD";
    const name = r.accommodation?.name || "Stay";
    const addr = r.accommodation?.location?.address;
    const locationHint = [addr?.line_one, addr?.city_name, addr?.region]
      .filter(Boolean)
      .join(", ");
    const free = r.cheapest_rate_free_cancellation ?? null;
    const rating = r.accommodation?.rating ?? null;
    const checkIn = r.check_in_date || input.checkInDate;
    const checkOut = r.check_out_date || input.checkOutDate;
    const bits = [
      name,
      locationHint || null,
      `${checkIn} → ${checkOut}`,
      free ? "Free cancellation" : null,
      rating != null ? `${rating}★` : null,
    ].filter(Boolean);
    return {
      id: r.id,
      name,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      freeCancellation: free,
      rating,
      accommodationId: r.accommodation?.id ?? null,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      summary: bits.join(" · "),
      locationHint: locationHint || null,
    };
  });
}

export async function searchStays(input: {
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  radiusKm?: number;
  maxResults?: number;
  flexDays?: number;
}): Promise<StayResultDto[]> {
  const flex = Math.max(0, input.flexDays ?? 0);
  const windows =
    flex > 0
      ? flexStayWindows(input.checkInDate, input.checkOutDate, flex, 5)
      : [{ checkIn: input.checkInDate, checkOut: input.checkOutDate }];

  const settled = await Promise.allSettled(
    windows.map((w) =>
      searchStaysOnce({
        latitude: input.latitude,
        longitude: input.longitude,
        checkInDate: w.checkIn,
        checkOutDate: w.checkOut,
        radiusKm: input.radiusKm,
      }),
    ),
  );

  const mapped: StayResultDto[] = [];
  const seen = new Set<string>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value) {
      const key = `${s.accommodationId || s.name}|${s.checkInDate}|${s.amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mapped.push(s);
    }
  }

  mapped.sort((a, b) => a.amount - b.amount);
  return mapped.slice(0, input.maxResults ?? 30);
}

/** Fresh offer (price + passenger ids + available services) before creating an order. */
export async function getOffer(
  offerId: string,
  opts?: { returnAvailableServices?: boolean },
): Promise<DuffelOffer> {
  if (!offerId) throw new Error("Offer id is required");
  return duffelFetch<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}`, {
    method: "GET",
    query: opts?.returnAvailableServices
      ? { return_available_services: "true" }
      : undefined,
  });
}

/** Seat maps for the Duffel Ancillaries seats UI. */
export async function getSeatMaps(offerId: string): Promise<unknown[]> {
  if (!offerId) throw new Error("Offer id is required");
  const data = await duffelFetch<unknown[]>("/air/seat_maps", {
    method: "GET",
    query: { offer_id: offerId },
  });
  return Array.isArray(data) ? data : [];
}

/** Short-lived client key safe to pass to Duffel browser components. */
export async function createComponentClientKey(): Promise<string> {
  const data = await duffelFetch<{ component_client_key?: string }>(
    "/identity/component_client_keys",
    {
      method: "POST",
      body: JSON.stringify({ data: {} }),
    },
  );
  const key = data?.component_client_key;
  if (!key) throw new Error("Duffel did not return a component client key");
  return key;
}

/**
 * Price an offer for card checkout (surcharges + intended services).
 * Call after card capture and before 3DS / create order.
 */
export async function priceOfferForCheckout(input: {
  offerId: string;
  cardId: string;
  services?: FlightOrderService[];
}): Promise<{
  offer: DuffelOffer;
  payment: PricedOfferPaymentMethod;
}> {
  const offer = await duffelFetch<DuffelOffer>(
    `/air/offers/${encodeURIComponent(input.offerId)}/actions/price`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          intended_payment_methods: [
            { type: "card", card_id: input.cardId },
          ],
          ...(input.services && input.services.length > 0
            ? { intended_services: input.services }
            : {}),
        },
      }),
    },
  );

  const method = offer.intended_payment_methods?.find((m) => m.type === "card");
  if (!method?.charge_amount || !method.charge_currency) {
    throw new Error(
      "Offer pricing did not return a card charge amount — try again.",
    );
  }

  return {
    offer,
    payment: {
      type: "card",
      cardId: method.card_id || input.cardId,
      chargeAmount: method.charge_amount,
      chargeCurrency: method.charge_currency,
      surchargeAmount: method.surcharge_amount ?? null,
      surchargeCurrency: method.surcharge_currency ?? null,
    },
  };
}

function toOrderPassenger(
  p: FlightOrderPassenger,
  passengerId: string,
): Record<string, unknown> {
  return {
    id: passengerId,
    given_name: p.givenName,
    family_name: p.familyName,
    born_on: p.bornOn,
    email: p.email,
    phone_number: p.phoneNumber,
    gender: p.gender,
    title: p.title ?? (p.gender === "f" ? "ms" : "mr"),
  };
}

/**
 * Create an instant flight order.
 * Payment: Duffel balance (test) or card + three_d_secure_session_id.
 */
export async function createFlightOrder(input: {
  offerId: string;
  passenger: FlightOrderPassenger;
  services?: FlightOrderService[];
  payment?: FlightOrderPayment;
}): Promise<FlightOrderResult> {
  const offer = await getOffer(input.offerId, {
    returnAvailableServices: true,
  });
  const pas = offer.passengers?.[0];
  if (!pas?.id) {
    throw new Error(
      "Offer has no passenger id — search again and choose a fresh offer.",
    );
  }
  if (!offer.total_amount || !offer.total_currency) {
    throw new Error("Offer is missing price; search again.");
  }

  const services = input.services?.filter((s) => s.id && s.quantity > 0) ?? [];

  /** Fare + selected ancillaries (balance must match; card uses priced charge_amount). */
  function balanceAmountWithServices(): { amount: string; currency: string } {
    let total = Number.parseFloat(offer.total_amount);
    if (!Number.isFinite(total)) {
      throw new Error("Offer total is not a number");
    }
    const available = offer.available_services ?? [];
    for (const svc of services) {
      const match = available.find((a) => a.id === svc.id);
      const unit = Number.parseFloat(match?.total_amount ?? "0");
      if (!match || !Number.isFinite(unit)) {
        throw new Error(
          `Service ${svc.id} is not available on this offer — refresh checkout.`,
        );
      }
      total += unit * svc.quantity;
    }
    return {
      amount: total.toFixed(2),
      currency: offer.total_currency,
    };
  }

  const payment: FlightOrderPayment =
    input.payment ??
    ({
      type: "balance",
      ...balanceAmountWithServices(),
    } satisfies FlightOrderPayment);

  // If caller passed balance with base fare only, bump amount when services selected.
  if (payment.type === "balance" && services.length > 0) {
    const withServices = balanceAmountWithServices();
    const passed = Number.parseFloat(payment.amount);
    const needed = Number.parseFloat(withServices.amount);
    if (
      !Number.isFinite(passed) ||
      Math.abs(passed - needed) > 0.009
    ) {
      payment.amount = withServices.amount;
      payment.currency = withServices.currency;
    }
  }

  const paymentPayload =
    payment.type === "card"
      ? {
          type: "card",
          amount: payment.amount,
          currency: payment.currency,
          three_d_secure_session_id: payment.threeDSecureSessionId,
        }
      : {
          type: "balance",
          amount: payment.amount,
          currency: payment.currency,
        };

  const order = await duffelFetch<DuffelOrder>("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [offer.id],
        payments: [paymentPayload],
        ...(services.length > 0 ? { services } : {}),
        passengers: [toOrderPassenger(input.passenger, pas.id)],
      },
    }),
  });

  const bookingReference =
    order.booking_reference ||
    order.documents?.find((d) => d.unique_identifier)?.unique_identifier ||
    order.id;

  const amount = Number.parseFloat(
    order.total_amount || payment.amount || offer.total_amount,
  );
  return {
    orderId: order.id,
    bookingReference,
    totalAmount: Number.isFinite(amount)
      ? amount
      : Number.parseFloat(offer.total_amount),
    totalCurrency:
      order.total_currency || payment.currency || offer.total_currency,
    offerId: offer.id,
    raw: order,
  };
}

/**
 * Place typeahead via Duffel Places. Falls back to static hubs when
 * DUFFEL_API_TOKEN is missing or the request fails.
 */
export async function suggestPlaces(
  query: string,
  max = 8,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  if (q.length < 2 && !/^[A-Za-z]{3}$/.test(q)) return [];

  if (!duffelConfigured()) {
    return filterStaticHubs(q, max);
  }

  try {
    const data = await duffelFetch<DuffelPlaceRaw[]>("/places/suggestions", {
      method: "GET",
      query: { name: q },
    });
    const ranked = mapAndRankDuffelPlaces(data ?? [], q, max);
    if (ranked.length > 0) return ranked;
    return filterStaticHubs(q, max);
  } catch {
    return filterStaticHubs(q, max);
  }
}

export type { PlaceSuggestion };
