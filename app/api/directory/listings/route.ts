import { NextResponse } from "next/server";
import {
  createDirectoryListing,
  DirectoryListingValidationError,
  isDirectoryCategory,
  listApprovedDirectoryListings,
  type DirectoryCategory,
} from "@/lib/directory/listings";
import { isDatabaseConfigured } from "@/lib/db/client";

type JoinBody = {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly city?: unknown;
  readonly region?: unknown;
  readonly country?: unknown;
  readonly description?: unknown;
  readonly website?: unknown;
  readonly instagram?: unknown;
  readonly contactEmail?: unknown;
  readonly contactPhone?: unknown;
  /** Honeypot — bots fill this; humans leave it empty. */
  readonly companyWebsite?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ listings: [] });
  }
  try {
    const listings = await listApprovedDirectoryListings();
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("directory listings GET failed", error);
    return NextResponse.json(
      { error: "Could not load listings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Directory is not available right now." },
      { status: 503 },
    );
  }

  let body: JoinBody;
  try {
    body = (await request.json()) as JoinBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: silently accept so scrapers think it worked.
  if (asString(body.companyWebsite).trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = asString(body.name);
  const categoryRaw = asString(body.category);
  const city = asString(body.city);
  const description = asString(body.description);

  if (
    name.length > 200 ||
    city.length > 120 ||
    description.length > 2000 ||
    asString(body.website).length > 400 ||
    asString(body.instagram).length > 400
  ) {
    return NextResponse.json({ error: "Submission is too long." }, { status: 400 });
  }

  if (!isDirectoryCategory(categoryRaw)) {
    return NextResponse.json({ error: "Pick a valid category." }, { status: 400 });
  }

  try {
    const created = await createDirectoryListing({
      name,
      category: categoryRaw as DirectoryCategory,
      city,
      region: asOptionalString(body.region),
      country: asOptionalString(body.country) ?? "US",
      description,
      website: asOptionalString(body.website),
      instagram: asOptionalString(body.instagram),
      contactEmail: asOptionalString(body.contactEmail),
      contactPhone: asOptionalString(body.contactPhone),
    });
    return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
  } catch (error) {
    if (error instanceof DirectoryListingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("directory listings POST failed", error);
    return NextResponse.json(
      { error: "Could not save your listing. Try again." },
      { status: 500 },
    );
  }
}
