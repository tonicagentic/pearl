export type HomeOccupancy = "rent" | "own" | "use";

export type HomeLineKind =
  | "rent"
  | "mortgage"
  | "property_tax"
  | "maintenance"
  | "utilities"
  | "internet"
  | "insurance"
  | "hoa"
  | "parking"
  | "use"
  | "other";

export const HOME_OCCUPANCY_LABELS: Record<HomeOccupancy, string> = {
  rent: "Rent",
  own: "Own",
  use: "Use (not owned)",
};

export const HOME_LINE_KIND_LABELS: Record<HomeLineKind, string> = {
  rent: "Rent",
  mortgage: "Mortgage",
  property_tax: "Property taxes",
  maintenance: "Maintenance",
  utilities: "Utilities",
  internet: "Internet",
  insurance: "Insurance",
  hoa: "HOA",
  parking: "Parking",
  use: "Use value",
  other: "Other",
};

export type HomeLineCadence =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

export const HOME_LINE_CADENCE_LABELS: Record<HomeLineCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

/** Default expense lines when creating a home, by occupancy. */
export function defaultHomeLines(
  occupancy: HomeOccupancy,
): { name: string; kind: HomeLineKind }[] {
  if (occupancy === "own") {
    return [
      { name: "Mortgage / rent equivalent", kind: "mortgage" },
      { name: "Property taxes", kind: "property_tax" },
      { name: "Maintenance", kind: "maintenance" },
      { name: "Home insurance", kind: "insurance" },
      { name: "Utilities", kind: "utilities" },
      { name: "Internet", kind: "internet" },
      { name: "HOA", kind: "hoa" },
      { name: "Parking", kind: "parking" },
    ];
  }
  if (occupancy === "use") {
    return [
      { name: "Use value", kind: "use" },
      { name: "Utilities", kind: "utilities" },
      { name: "Internet", kind: "internet" },
    ];
  }
  return [
    { name: "Rent", kind: "rent" },
    { name: "Renter's insurance", kind: "insurance" },
    { name: "Utilities", kind: "utilities" },
    { name: "Internet", kind: "internet" },
    { name: "Parking", kind: "parking" },
    { name: "Household supplies", kind: "other" },
    { name: "Furniture and furnishings", kind: "other" },
    { name: "Laundry", kind: "other" },
  ];
}

export function slugifyHome(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function formatHomeStreet(home: {
  addressLine1?: string | null;
  addressLine2?: string | null;
}): string | null {
  const line1 = home.addressLine1?.trim() || "";
  const line2 = home.addressLine2?.trim() || "";
  if (!line1 && !line2) return null;
  return [line1, line2].filter(Boolean).join(line2.startsWith("#") ? " " : ", ");
}

export function formatHomeLocality(home: {
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}): string | null {
  if (home.city && home.region && home.postalCode) {
    return `${home.city}, ${home.region} ${home.postalCode}`;
  }
  if (home.city && home.region) {
    return `${home.city}, ${home.region}`;
  }
  const locality = [home.city, home.region, home.postalCode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return locality || null;
}

export function formatHomeAddress(home: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}): string | null {
  const street = formatHomeStreet(home);
  const locality = formatHomeLocality(home);
  const parts = [street || null, locality || null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
