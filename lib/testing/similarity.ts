// Memory write dedupe for the reliability suite (and for tools that want the
// same guarantee). The unit tier pins these semantics; the write-amplification
// eval uses them to score a scripted session's memory writes.

/** Lowercase, collapse whitespace, strip possessives and punctuation (keep
 * path separators like Pacific/Auckland and hyphens), trim trailing marks. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]s\b/g, "")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exact match, then normalized-text match — the minimum dedupe contract. */
export function isDuplicate(
  candidate: string,
  existing: readonly string[],
): boolean {
  const normalized = normalizeText(candidate);

  return existing.some(
    (entry) =>
      entry === candidate ||
      normalizeText(entry) === normalized ||
      // "User's timezone is Pacific/Auckland (NZT)" vs without the suffix.
      jaccardSimilarity(normalizeText(entry), normalized) > NEAR_DUPLICATE_THRESHOLD,
  );
}

/** Word-bag Jaccard similarity in [0, 1] — near-duplicate detection. */
export const NEAR_DUPLICATE_THRESHOLD = 0.6;

/** Word-bag Jaccard similarity in [0, 1] — near-duplicate detection. */
export function jaccardSimilarity(a: string, b: string): number {
  const bagA = new Set(a.split(" ").filter(Boolean));
  const bagB = new Set(b.split(" ").filter(Boolean));

  if (bagA.size === 0 && bagB.size === 0) return 1;

  let intersection = 0;
  for (const word of bagA) {
    if (bagB.has(word)) intersection++;
  }

  const union = bagA.size + bagB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
