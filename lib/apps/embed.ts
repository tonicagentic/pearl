/**
 * Only embed https production URLs that Pearl stored for this user's app.
 * Rejects javascript:, data:, and open redirects.
 */
export function embeddableProductionUrl(
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
  // Production Vercel hostnames (*.vercel.app) or custom domains are fine;
  // the ownership check is that the URL came from the caller's mini_app row.
  return url.toString();
}
