/**
 * Which social sign-in providers are configured on this deploy.
 * Safe to call from server components; for client UI prefer the
 * NEXT_PUBLIC_* client IDs (they are public OAuth client identifiers).
 */
export function getConfiguredSocialProviders() {
  const google = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const apple = Boolean(
    process.env.APPLE_CLIENT_ID?.trim() &&
      process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );
  const vercel = Boolean(
    process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID?.trim() &&
      process.env.VERCEL_APP_CLIENT_SECRET?.trim() &&
      process.env.BETTER_AUTH_SECRET?.trim(),
  );

  return { google, apple, vercel } as const;
}

/** Client-safe flags (OAuth client IDs are public). */
export function getPublicSocialProviders() {
  return {
    google: Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()),
    apple: Boolean(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim()),
  } as const;
}
