/** Normalize picker MIME so CSV/JSON land in the text/* allowlist. */
export function normalizeAttachmentMediaType(
  name: string,
  mimeType: string | undefined,
): string {
  const lower = (mimeType ?? "").toLowerCase();
  if (lower && lower !== "application/octet-stream" && lower !== "public.data") {
    if (lower === "application/csv") return "text/csv";
    return lower;
  }
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.csv$/i.test(name)) return "text/csv";
  if (/\.json$/i.test(name)) return "application/json";
  if (/\.md$/i.test(name)) return "text/markdown";
  if (/\.txt$/i.test(name)) return "text/plain";
  if (/\.(jpe?g|png|gif|webp)$/i.test(name)) return "image/jpeg";
  return lower || "application/octet-stream";
}

export function isSupportedAttachment(
  name: string,
  mimeType: string | undefined,
): boolean {
  if (/\.(pdf|csv|txt|md|json)$/i.test(name)) return true;
  const media = normalizeAttachmentMediaType(name, mimeType);
  return (
    media.startsWith("image/") ||
    media.startsWith("text/") ||
    media === "application/pdf" ||
    media === "application/json"
  );
}
