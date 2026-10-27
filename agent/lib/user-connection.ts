/** True when the active eve session is a Better Auth end-user principal. */
export function isBetterAuthUserPrincipal(
  auth: { readonly principalType?: string; readonly issuer?: string } | null | undefined,
): boolean {
  return auth?.principalType === "user" && auth.issuer === "better-auth";
}
