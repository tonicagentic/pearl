// Identity profile client for the mobile app: hits /api/profile with the
// same better-auth credential the eve transport uses.

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export type ProfileDto = {
  displayName: string | null;
  birthdate: string | null;
  ageYears: number | null;
  nationality: string | null;
  height: string | null;
  eyeColor: string | null;
  hairColor: string | null;
  skinTone: string | null;
  weight: string | null;
  build: string | null;
  gender: string | null;
  measurements: string | null;
  healthNotes: string | null;
  primaryResidence: string | null;
  additionalHomes: string | null;
  updatedAt: string | null;
};

export type ProfileFormInput = {
  displayName?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  height?: string | null;
  eyeColor?: string | null;
  hairColor?: string | null;
  skinTone?: string | null;
  weight?: string | null;
  build?: string | null;
  gender?: string | null;
  measurements?: string | null;
  healthNotes?: string | null;
  primaryResidence?: string | null;
  additionalHomes?: string | null;
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) {
    sessionInvalid();
  }
  let detail = fallback;
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) {
      detail = data.error;
    }
  } catch {
    // keep fallback
  }
  throw new Error(detail);
}

export async function fetchProfile(): Promise<ProfileDto | null> {
  const response = await fetch(`${AGENT_URL}/api/profile`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    await parseError(response, "Could not load profile");
  }
  const data = (await response.json()) as { profile: ProfileDto | null };
  return data.profile;
}

export async function saveProfile(
  input: ProfileFormInput,
): Promise<ProfileDto> {
  const response = await fetch(`${AGENT_URL}/api/profile`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, "Could not save profile");
  }
  const data = (await response.json()) as { profile: ProfileDto };
  return data.profile;
}
