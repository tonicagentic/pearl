/**
 * Initials for the Profile control: first+last word letters when the name has
 * two or more words, otherwise the first two letters of a single token.
 * Falls back to the email local-part when name is empty.
 */
export function initials(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const fromName = initialsFromLabel(name);
  if (fromName) return fromName;
  const local = email?.split("@")[0]?.trim() ?? "";
  return initialsFromLabel(local);
}

function initialsFromLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const words = raw
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return null;
  if (words.length >= 2) {
    const first = words[0]?.[0];
    const last = words[words.length - 1]?.[0];
    if (!first || !last) return null;
    return `${first}${last}`.toUpperCase();
  }
  const word = words[0] ?? "";
  if (word.length >= 2) return word.slice(0, 2).toUpperCase();
  if (word.length === 1) return word.toUpperCase();
  return null;
}
