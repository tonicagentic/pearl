import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  directoryListing,
  type DirectoryListing,
  type DirectoryListingStatus,
} from "@/lib/db/schema";
import {
  isDirectoryCategory,
  type DirectoryCategory,
  type PublicDirectoryListing,
} from "@/lib/directory/shared";

export type { DirectoryCategory, PublicDirectoryListing };
export {
  DIRECTORY_CATEGORIES,
  DIRECTORY_CATEGORY_LABELS,
  filterDirectoryListings,
  isDirectoryCategory,
} from "@/lib/directory/shared";

export type CreateDirectoryListingInput = {
  readonly name: string;
  readonly category: DirectoryCategory;
  readonly city: string;
  readonly region?: string | null;
  readonly country?: string;
  readonly description: string;
  readonly website?: string | null;
  readonly instagram?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
};

const MAX_NAME = 120;
const MAX_CITY = 80;
const MAX_REGION = 80;
const MAX_COUNTRY = 56;
const MAX_DESCRIPTION = 600;
const MAX_URL = 240;
const MAX_EMAIL = 160;
const MAX_PHONE = 40;

export function slugifyDirectoryName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "listing";
}

function trimOrNull(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function requireTrimmed(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DirectoryListingValidationError(`${label} is required.`);
  return trimmed.slice(0, max);
}

export class DirectoryListingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryListingValidationError";
  }
}

function toPublic(row: DirectoryListing): PublicDirectoryListing {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    city: row.city,
    region: row.region,
    country: row.country,
    description: row.description,
    website: row.website,
    instagram: row.instagram,
  };
}

export async function listApprovedDirectoryListings(): Promise<
  PublicDirectoryListing[]
> {
  const rows = await db
    .select()
    .from(directoryListing)
    .where(eq(directoryListing.status, "approved" satisfies DirectoryListingStatus))
    .orderBy(asc(directoryListing.name));
  return rows.map(toPublic);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const existing = await db
      .select({ id: directoryListing.id })
      .from(directoryListing)
      .where(eq(directoryListing.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createDirectoryListing(
  input: CreateDirectoryListingInput,
): Promise<{ id: string; slug: string }> {
  const name = requireTrimmed(input.name, MAX_NAME, "Name");
  if (!isDirectoryCategory(input.category)) {
    throw new DirectoryListingValidationError("Pick a valid category.");
  }
  const city = requireTrimmed(input.city, MAX_CITY, "City");
  const description = requireTrimmed(
    input.description,
    MAX_DESCRIPTION,
    "Description",
  );
  const contactEmail = trimOrNull(input.contactEmail, MAX_EMAIL);
  const contactPhone = trimOrNull(input.contactPhone, MAX_PHONE);
  if (!contactEmail && !contactPhone) {
    throw new DirectoryListingValidationError(
      "Add an email or phone so Pearl can reach you.",
    );
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new DirectoryListingValidationError("Enter a valid email.");
  }

  const website = trimOrNull(input.website, MAX_URL);
  const instagram = trimOrNull(input.instagram, MAX_URL);
  const region = trimOrNull(input.region, MAX_REGION);
  const country = requireTrimmed(input.country ?? "US", MAX_COUNTRY, "Country");
  const slug = await uniqueSlug(slugifyDirectoryName(name));

  const [row] = await db
    .insert(directoryListing)
    .values({
      name,
      slug,
      category: input.category,
      city,
      region,
      country,
      description,
      website,
      instagram,
      contactEmail,
      contactPhone,
      status: "pending",
      source: "self_serve",
      updatedAt: sql`now()`,
    })
    .returning({ id: directoryListing.id, slug: directoryListing.slug });

  if (!row) {
    throw new Error("Failed to create directory listing.");
  }
  return row;
}
