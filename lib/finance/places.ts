export type PlaceType = "city" | "airport";

export type PlaceSuggestion = {
  iata: string;
  name: string;
  type: PlaceType;
  cityName: string | null;
  country: string | null;
};

export type DuffelPlaceRaw = {
  type?: string | null;
  name?: string | null;
  iata_code?: string | null;
  iata_city_code?: string | null;
  iata_country_code?: string | null;
  city_name?: string | null;
  city?: { name?: string | null; iata_code?: string | null } | null;
};

/** Common US / hub places for offline / no-token fallback. */
export const STATIC_HUB_PLACES: PlaceSuggestion[] = [
  { iata: "SFO", name: "San Francisco", type: "city", cityName: "San Francisco", country: "US" },
  { iata: "SFO", name: "San Francisco International", type: "airport", cityName: "San Francisco", country: "US" },
  { iata: "OAK", name: "Oakland International", type: "airport", cityName: "Oakland", country: "US" },
  { iata: "SJC", name: "San Jose International", type: "airport", cityName: "San Jose", country: "US" },
  { iata: "LAX", name: "Los Angeles", type: "city", cityName: "Los Angeles", country: "US" },
  { iata: "LAX", name: "Los Angeles International", type: "airport", cityName: "Los Angeles", country: "US" },
  { iata: "DEN", name: "Denver", type: "city", cityName: "Denver", country: "US" },
  { iata: "DEN", name: "Denver International", type: "airport", cityName: "Denver", country: "US" },
  { iata: "NYC", name: "New York", type: "city", cityName: "New York", country: "US" },
  { iata: "EWR", name: "Newark Liberty International", type: "airport", cityName: "Newark", country: "US" },
  { iata: "JFK", name: "John F. Kennedy International", type: "airport", cityName: "New York", country: "US" },
  { iata: "LGA", name: "LaGuardia", type: "airport", cityName: "New York", country: "US" },
  { iata: "ORD", name: "Chicago", type: "city", cityName: "Chicago", country: "US" },
  { iata: "ORD", name: "O'Hare International", type: "airport", cityName: "Chicago", country: "US" },
  { iata: "MDW", name: "Chicago Midway", type: "airport", cityName: "Chicago", country: "US" },
  { iata: "BOS", name: "Boston", type: "city", cityName: "Boston", country: "US" },
  { iata: "BOS", name: "Logan International", type: "airport", cityName: "Boston", country: "US" },
  { iata: "SEA", name: "Seattle", type: "city", cityName: "Seattle", country: "US" },
  { iata: "SEA", name: "Seattle-Tacoma International", type: "airport", cityName: "Seattle", country: "US" },
  { iata: "DFW", name: "Dallas-Fort Worth", type: "city", cityName: "Dallas", country: "US" },
  { iata: "DFW", name: "Dallas/Fort Worth International", type: "airport", cityName: "Dallas", country: "US" },
  { iata: "ATL", name: "Atlanta", type: "city", cityName: "Atlanta", country: "US" },
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta", type: "airport", cityName: "Atlanta", country: "US" },
  { iata: "MIA", name: "Miami", type: "city", cityName: "Miami", country: "US" },
  { iata: "MIA", name: "Miami International", type: "airport", cityName: "Miami", country: "US" },
  { iata: "IAD", name: "Washington Dulles", type: "airport", cityName: "Washington", country: "US" },
  { iata: "DCA", name: "Ronald Reagan Washington National", type: "airport", cityName: "Washington", country: "US" },
  { iata: "WAS", name: "Washington", type: "city", cityName: "Washington", country: "US" },
  { iata: "PHX", name: "Phoenix", type: "city", cityName: "Phoenix", country: "US" },
  { iata: "PHX", name: "Phoenix Sky Harbor", type: "airport", cityName: "Phoenix", country: "US" },
  { iata: "LAS", name: "Las Vegas", type: "city", cityName: "Las Vegas", country: "US" },
  { iata: "LAS", name: "Harry Reid International", type: "airport", cityName: "Las Vegas", country: "US" },
  { iata: "PDX", name: "Portland", type: "city", cityName: "Portland", country: "US" },
  { iata: "PDX", name: "Portland International", type: "airport", cityName: "Portland", country: "US" },
  { iata: "MSP", name: "Minneapolis", type: "city", cityName: "Minneapolis", country: "US" },
  { iata: "MSP", name: "Minneapolis–Saint Paul", type: "airport", cityName: "Minneapolis", country: "US" },
  { iata: "DTW", name: "Detroit", type: "city", cityName: "Detroit", country: "US" },
  { iata: "DTW", name: "Detroit Metropolitan", type: "airport", cityName: "Detroit", country: "US" },
  { iata: "IAH", name: "Houston", type: "city", cityName: "Houston", country: "US" },
  { iata: "IAH", name: "George Bush Intercontinental", type: "airport", cityName: "Houston", country: "US" },
  { iata: "SAN", name: "San Diego", type: "city", cityName: "San Diego", country: "US" },
  { iata: "SAN", name: "San Diego International", type: "airport", cityName: "San Diego", country: "US" },
  { iata: "HNL", name: "Honolulu", type: "city", cityName: "Honolulu", country: "US" },
  { iata: "HNL", name: "Daniel K. Inouye International", type: "airport", cityName: "Honolulu", country: "US" },
  { iata: "SLC", name: "Salt Lake City", type: "city", cityName: "Salt Lake City", country: "US" },
  { iata: "SLC", name: "Salt Lake City International", type: "airport", cityName: "Salt Lake City", country: "US" },
  { iata: "ASE", name: "Aspen", type: "city", cityName: "Aspen", country: "US" },
  { iata: "ASE", name: "Aspen/Pitkin County", type: "airport", cityName: "Aspen", country: "US" },
  { iata: "EGE", name: "Eagle County", type: "airport", cityName: "Vail", country: "US" },
  { iata: "LON", name: "London", type: "city", cityName: "London", country: "GB" },
  { iata: "LHR", name: "Heathrow", type: "airport", cityName: "London", country: "GB" },
  { iata: "PAR", name: "Paris", type: "city", cityName: "Paris", country: "FR" },
  { iata: "CDG", name: "Charles de Gaulle", type: "airport", cityName: "Paris", country: "FR" },
];

export function mapDuffelPlace(raw: DuffelPlaceRaw): PlaceSuggestion | null {
  const iata = (raw.iata_code || "").toUpperCase().trim();
  if (!iata || iata.length !== 3) return null;
  const type: PlaceType = raw.type === "city" ? "city" : "airport";
  const name = (raw.name || iata).trim();
  const cityName =
    raw.city_name ||
    raw.city?.name ||
    (type === "city" ? name : null) ||
    null;
  return {
    iata,
    name,
    type,
    cityName,
    country: raw.iata_country_code ?? null,
  };
}

export function placeDisplayLabel(p: {
  iata: string;
  name?: string | null;
  label?: string | null;
}): string {
  const name = (p.label || p.name || p.iata).trim();
  if (!p.iata) return name;
  if (name.toUpperCase() === p.iata.toUpperCase()) return p.iata;
  return `${name} (${p.iata})`;
}

/**
 * Rank suggestions: exact IATA first, then cities, then airports;
 * within each group prefer name/city prefix matches.
 */
export function rankPlaceSuggestions(
  places: PlaceSuggestion[],
  query: string,
  max = 8,
): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  const qUpper = q.toUpperCase();

  const scored = places
    .map((p) => {
      const iata = p.iata.toUpperCase();
      const name = p.name.toLowerCase();
      const city = (p.cityName || "").toLowerCase();
      let score: number | null = null;
      if (iata === qUpper) score = 0;
      else if (iata.startsWith(qUpper)) score = 10;
      else if (name.startsWith(q) || city.startsWith(q)) score = 20;
      else if (
        iata.includes(qUpper) ||
        name.includes(q) ||
        city.includes(q)
      ) {
        score = 40;
      }
      if (score == null) return null;
      if (p.type === "airport") score += 1;
      return { p, score };
    })
    .filter((x): x is { p: PlaceSuggestion; score: number } => x != null);

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.p.type !== b.p.type) return a.p.type === "city" ? -1 : 1;
    return a.p.name.localeCompare(b.p.name);
  });

  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const { p } of scored) {
    const key = `${p.type}:${p.iata}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export function filterStaticHubs(query: string, max = 8): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = STATIC_HUB_PLACES.filter((p) => {
    return (
      p.iata.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.cityName || "").toLowerCase().includes(q)
    );
  });
  return rankPlaceSuggestions(matches, query, max);
}

export function mapAndRankDuffelPlaces(
  raw: DuffelPlaceRaw[],
  query: string,
  max = 8,
): PlaceSuggestion[] {
  const mapped = raw
    .map(mapDuffelPlace)
    .filter((p): p is PlaceSuggestion => p != null);
  return rankPlaceSuggestions(mapped, query, max);
}
