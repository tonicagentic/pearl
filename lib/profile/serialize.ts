import type { UserProfile } from "@/lib/db/schema";
import { ageYearsFromBirthdate } from "@/lib/profile/validation";

/** Public JSON shape for Settings UI and get_profile. */
export type ProfileDto = {
  readonly displayName: string | null;
  readonly birthdate: string | null;
  readonly ageYears: number | null;
  readonly nationality: string | null;
  readonly height: string | null;
  readonly eyeColor: string | null;
  readonly hairColor: string | null;
  readonly skinTone: string | null;
  readonly weight: string | null;
  readonly build: string | null;
  readonly gender: string | null;
  readonly measurements: string | null;
  readonly healthNotes: string | null;
  readonly primaryResidence: string | null;
  readonly additionalHomes: string | null;
  readonly updatedAt: string | null;
};

function dateToIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function toProfileDto(row: UserProfile | null): ProfileDto | null {
  if (!row) {
    return null;
  }
  const birthdate = dateToIso(row.birthdate);
  return {
    displayName: row.displayName,
    birthdate,
    ageYears: ageYearsFromBirthdate(birthdate),
    nationality: row.nationality,
    height: row.height,
    eyeColor: row.eyeColor,
    hairColor: row.hairColor,
    skinTone: row.skinTone,
    weight: row.weight,
    build: row.build,
    gender: row.gender,
    measurements: row.measurements,
    healthNotes: row.healthNotes,
    primaryResidence: row.primaryResidence,
    additionalHomes: row.additionalHomes,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Drop null/empty fields for a compact agent tool payload. */
export function compactProfileDto(
  dto: ProfileDto,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    out[key] = value;
  }
  return out;
}
