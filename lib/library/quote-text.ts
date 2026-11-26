/** Pure validation and matching for Library Quotes saved from chat selections. */

export const MAX_QUOTE_LENGTH = 8_000;

/**
 * Trim and validate quote text. Returns the cleaned string, or throws with a
 * user-facing message when empty or too long.
 */
export function requireQuoteText(raw: string): string {
  const text = raw.trim();
  if (!text) {
    throw new Error("Select some text to save as a quote.");
  }
  if (text.length > MAX_QUOTE_LENGTH) {
    throw new Error(
      `Quotes must be ${MAX_QUOTE_LENGTH.toLocaleString("en-US")} characters or fewer.`,
    );
  }
  return text;
}

export type QuoteSpan = {
  readonly start: number;
  readonly end: number;
};

/**
 * Find `needle` inside `haystack` after collapsing runs of whitespace in both.
 * Returns indexes into the original `haystack`, or null when there is no match.
 *
 * Browser and mobile selections often join paragraphs with a single newline or
 * space; collapsing whitespace keeps those selections locatable in rendered
 * text that may use different breaks.
 */
export function findQuoteSpan(
  haystack: string,
  needle: string,
): QuoteSpan | null {
  const trimmedNeedle = needle.trim();
  if (!trimmedNeedle || !haystack) return null;

  const { collapsed: collapsedHaystack, map } = collapseWhitespace(haystack);
  const collapsedNeedle = collapseWhitespace(trimmedNeedle).collapsed;
  if (!collapsedNeedle) return null;

  const collapsedStart = collapsedHaystack.indexOf(collapsedNeedle);
  if (collapsedStart < 0) return null;

  const collapsedEnd = collapsedStart + collapsedNeedle.length;
  // map[i] is the original index of collapsedHaystack[i]. The span end is the
  // original index just past the last matched character.
  const start = map[collapsedStart];
  const lastMapped = map[collapsedEnd - 1];
  if (start === undefined || lastMapped === undefined) return null;

  return { start, end: lastMapped + 1 };
}

/**
 * Collapse every run of whitespace to a single space and record where each
 * kept character came from in the original string.
 */
function collapseWhitespace(input: string): {
  readonly collapsed: string;
  readonly map: readonly number[];
} {
  const map: number[] = [];
  let collapsed = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      // Skip the whole run; emit one space if we already have content that
      // is not already followed by a space (leading/trailing runs drop).
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) j += 1;
      if (collapsed.length > 0 && collapsed[collapsed.length - 1] !== " ") {
        // Map the emitted space to the first whitespace char of the run.
        map.push(i);
        collapsed += " ";
      }
      i = j;
      continue;
    }
    map.push(i);
    collapsed += ch;
    i += 1;
  }
  // Trim a trailing collapsed space so needle/haystack edges match.
  if (collapsed.endsWith(" ")) {
    collapsed = collapsed.slice(0, -1);
    map.pop();
  }
  return { collapsed, map };
}
