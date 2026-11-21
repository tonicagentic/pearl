/** Client-safe directory constants and helpers (no DB imports). */

export const DIRECTORY_CATEGORIES = [
  "salon",
  "cafe",
  "restaurant",
  "photographer",
  "designer",
  "fitness",
  "other",
] as const;

export type DirectoryCategory = (typeof DIRECTORY_CATEGORIES)[number];

export const DIRECTORY_CATEGORY_LABELS: Record<DirectoryCategory, string> = {
  salon: "Salon & beauty",
  cafe: "Café",
  restaurant: "Restaurant",
  photographer: "Photographer",
  designer: "Designer",
  fitness: "Fitness",
  other: "Other",
};

/** Public shape returned to marketing / API clients (no contact secrets). */
export type PublicDirectoryListing = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly category: string;
  readonly city: string;
  readonly region: string | null;
  readonly country: string;
  readonly description: string;
  readonly website: string | null;
  readonly instagram: string | null;
};

export function isDirectoryCategory(
  value: string,
): value is DirectoryCategory {
  return (DIRECTORY_CATEGORIES as readonly string[]).includes(value);
}

/** Lightweight filter for approved listings shown in the partner search. */
export function filterDirectoryListings(
  rows: readonly PublicDirectoryListing[],
  query: string,
): PublicDirectoryListing[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => {
    const hay = [
      row.name,
      row.category,
      row.city,
      row.region ?? "",
      row.description,
      DIRECTORY_CATEGORY_LABELS[row.category as DirectoryCategory] ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
