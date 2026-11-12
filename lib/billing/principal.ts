/**
 * Resolve the signed-in user id from an eve tool/hook session auth snapshot.
 */
export function principalIdFromAuth(auth: {
  readonly current?: { readonly principalId?: string } | null;
  readonly initiator?: { readonly principalId?: string } | null;
} | null | undefined): string | null {
  return (
    auth?.current?.principalId ?? auth?.initiator?.principalId ?? null
  );
}
