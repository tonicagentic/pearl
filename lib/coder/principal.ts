import { isBetterAuthUserPrincipal } from "@/agent/lib/user-connection";

/** Resolve the signed-in Better Auth user id from an eve session principal. */
export function requireCoderUserId(
  auth: { readonly principalType?: string; readonly issuer?: string; readonly principalId?: string } | null | undefined,
): { readonly userId: string } | { readonly error: string } {
  if (!isBetterAuthUserPrincipal(auth) || !auth?.principalId) {
    return {
      error:
        "Sign in with a personal account and connect GitHub (and Vercel when deploying) in Settings.",
    };
  }
  return { userId: auth.principalId };
}

export function coderCoAuthor(
  auth: {
    readonly attributes?: Record<string, unknown> | null;
  } | null | undefined,
): { readonly name: string; readonly email: string } | null {
  const name =
    typeof auth?.attributes?.name === "string"
      ? auth.attributes.name.trim()
      : "";
  const email =
    typeof auth?.attributes?.email === "string"
      ? auth.attributes.email.trim()
      : "";
  if (!name || !email) return null;
  return { name, email };
}
