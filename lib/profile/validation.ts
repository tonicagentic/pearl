/** Max length for short identity fields (name, nationality, eye color, …). */
export const MAX_PROFILE_FIELD_LENGTH = 200;

/** Max length for measurements and health notes. */
export const MAX_PROFILE_NOTES_LENGTH = 2_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ProfileValidationError = {
  readonly field?: string;
  readonly message: string;
};

export type ProfileFormInput = {
  readonly displayName?: string | null;
  readonly birthdate?: string | null;
  readonly nationality?: string | null;
  readonly height?: string | null;
  readonly eyeColor?: string | null;
  readonly hairColor?: string | null;
  readonly skinTone?: string | null;
  readonly weight?: string | null;
  readonly build?: string | null;
  readonly gender?: string | null;
  readonly measurements?: string | null;
  readonly healthNotes?: string | null;
  readonly primaryResidence?: string | null;
  readonly additionalHomes?: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateShort(
  field: string,
  value: string | null,
): ProfileValidationError | null {
  if (value && value.length > MAX_PROFILE_FIELD_LENGTH) {
    return {
      field,
      message: `${field} must be at most ${String(MAX_PROFILE_FIELD_LENGTH)} characters.`,
    };
  }
  return null;
}

function validateNotes(
  field: string,
  value: string | null,
): ProfileValidationError | null {
  if (value && value.length > MAX_PROFILE_NOTES_LENGTH) {
    return {
      field,
      message: `${field} must be at most ${String(MAX_PROFILE_NOTES_LENGTH)} characters.`,
    };
  }
  return null;
}

/**
 * Normalize and validate identity form input. Empty strings become null.
 * Throws with a user-facing message on invalid input.
 */
export function normalizeProfileInput(input: ProfileFormInput): {
  readonly displayName: string | null;
  readonly birthdate: string | null;
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
} {
  const displayName = trimOrNull(input.displayName);
  const birthdate = trimOrNull(input.birthdate);
  const nationality = trimOrNull(input.nationality);
  const height = trimOrNull(input.height);
  const eyeColor = trimOrNull(input.eyeColor);
  const hairColor = trimOrNull(input.hairColor);
  const skinTone = trimOrNull(input.skinTone);
  const weight = trimOrNull(input.weight);
  const build = trimOrNull(input.build);
  const gender = trimOrNull(input.gender);
  const measurements = trimOrNull(input.measurements);
  const healthNotes = trimOrNull(input.healthNotes);
  const primaryResidence = trimOrNull(input.primaryResidence);
  const additionalHomes = trimOrNull(input.additionalHomes);

  if (birthdate && !ISO_DATE.test(birthdate)) {
    throw new Error("Birthdate must be YYYY-MM-DD.");
  }
  if (birthdate) {
    const parsed = new Date(`${birthdate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Birthdate must be a valid date.");
    }
    if (parsed.getTime() > Date.now()) {
      throw new Error("Birthdate cannot be in the future.");
    }
  }

  for (const [field, value] of [
    ["displayName", displayName],
    ["nationality", nationality],
    ["height", height],
    ["eyeColor", eyeColor],
    ["hairColor", hairColor],
    ["skinTone", skinTone],
    ["weight", weight],
    ["build", build],
    ["gender", gender],
    ["primaryResidence", primaryResidence],
    ["additionalHomes", additionalHomes],
  ] as const) {
    const error = validateShort(field, value);
    if (error) {
      throw new Error(error.message);
    }
  }

  for (const [field, value] of [
    ["measurements", measurements],
    ["healthNotes", healthNotes],
  ] as const) {
    const error = validateNotes(field, value);
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    displayName,
    birthdate,
    nationality,
    height,
    eyeColor,
    hairColor,
    skinTone,
    weight,
    build,
    gender,
    measurements,
    healthNotes,
    primaryResidence,
    additionalHomes,
  };
}

/** Whole years of age from an ISO birthdate, or null. */
export function ageYearsFromBirthdate(
  birthdate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthdate || !ISO_DATE.test(birthdate)) {
    return null;
  }
  const born = new Date(`${birthdate}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) {
    return null;
  }
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const month = now.getUTCMonth() - born.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}
