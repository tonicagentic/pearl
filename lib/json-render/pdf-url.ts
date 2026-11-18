/** True when `src` is an https URL that looks like a PDF (path or content-type hint). */
export function isHttpsPdfUrl(src: string | null | undefined): boolean {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed.toLowerCase().startsWith("https://")) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    const path = url.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return true;
    // Query/hash often used by blob/CDN download links.
    if (/\.pdf(?:$|[?#])/i.test(trimmed)) return true;
    // Allow explicit format hints without a .pdf path.
    if (url.searchParams.get("format")?.toLowerCase() === "pdf") return true;
    return false;
  } catch {
    return false;
  }
}

export function httpsImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed.toLowerCase().startsWith("https://")) return null;
  return trimmed;
}
