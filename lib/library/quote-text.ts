/** Pure validation for Library Quotes saved from chat selections. */

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
