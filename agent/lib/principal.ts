import { ensureUserForPrincipal } from "@/lib/db/issues";

/**
 * Resolve a DB user id from the eve session principal. Accepts signed-in
 * users and the local-dev principal (evals / eve dev), which seeds a user
 * row keyed by principalId.
 */
export function principalUserId(
  principal:
    | {
        readonly principalId?: string;
        readonly principalType?: string;
      }
    | null
    | undefined,
): string | null {
  if (!principal?.principalId) return null;
  if (
    principal.principalType === "user" ||
    principal.principalType === "local-dev"
  ) {
    return principal.principalId;
  }
  return null;
}

export async function requirePrincipalUser(
  principal: {
    readonly principalId: string;
    readonly principalType: string;
    readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
  } | null,
): Promise<
  | { readonly userId: string; readonly principal: NonNullable<typeof principal> }
  | { readonly error: string }
> {
  const userId = principalUserId(principal);
  if (!principal || !userId) {
    return { error: "No signed-in user." };
  }
  await ensureUserForPrincipal({
    principalId: principal.principalId,
    attributes: principal.attributes ?? {},
  });
  return { userId, principal };
}
