import { getUserProfile } from "@/lib/db/profile";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import {
  compactProfileDto,
  toProfileDto,
} from "@/lib/profile/serialize";

/**
 * Structural subset of eve's session principal for profile tools.
 */
export type ProfilePrincipal =
  | {
      readonly principalId: string;
      readonly principalType: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    }
  | null
  | undefined;

function requireUserPrincipal(principal: ProfilePrincipal): {
  readonly principalId: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
} {
  if (principal?.principalType !== "user" || !principal.principalId) {
    throw new Error("Sign in to read your identity profile.");
  }
  return {
    principalId: principal.principalId,
    attributes: principal.attributes ?? {},
  };
}

export async function getProfileForPrincipal(principal: ProfilePrincipal) {
  const user = requireUserPrincipal(principal);
  await ensureUserForPrincipal({
    principalId: user.principalId,
    attributes: user.attributes,
  });
  const row = await getUserProfile(user.principalId);
  const dto = toProfileDto(row);
  if (!dto) {
    return { found: false as const, profile: {} as Record<string, never> };
  }
  return {
    found: true as const,
    profile: compactProfileDto(dto),
  };
}
