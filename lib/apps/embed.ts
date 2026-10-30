/**
 * Only embed https URLs that Pearl stored for this user's app.
 * Rejects javascript:, data:, and open redirects.
 *
 * Used for both production deployments and sandbox draft previews
 * (`*.vercel.run`). Ownership is enforced by loading the URL from the
 * caller's mini_app row — never from user-supplied query strings.
 */
export function embeddableAppUrl(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  let url: URL;
  try {
    url = new URL(stored);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/** @deprecated Prefer {@link embeddableAppUrl}. */
export function embeddableProductionUrl(
  stored: string | null | undefined,
): string | null {
  return embeddableAppUrl(stored);
}

/**
 * Prefer the live production URL; fall back to a sandbox draft preview.
 */
export function preferEmbedUrl(app: {
  readonly productionUrl: string | null;
  readonly previewUrl: string | null;
}): string | null {
  return (
    embeddableAppUrl(app.productionUrl) ?? embeddableAppUrl(app.previewUrl)
  );
}
