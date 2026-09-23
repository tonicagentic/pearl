import { arrowLineCount, MAX_ARROW_LINES } from "./arrow-notation.ts";

/**
 * Deterministic checks for the always-on house mechanical rules.
 *
 * @remarks
 * Sources: the mechanical minimums in `agent/instructions.md`, the mechanical
 * rules in `agent/skills/house-style.md`, and the voice rules in the
 * `public-editorial-voice` skill that are mechanically checkable:
 *
 * - em dashes sparingly (density, not a ban)
 * - arrows reserved for diagrams/equations/schematic passages
 * - straight quotes and apostrophes (no curly characters)
 * - no single-item lists (one item is a sentence)
 * - few exclamation points
 * - content headings instead of generic labels
 * - precision over intensity (no hype vocabulary)
 *
 * Fenced code blocks are excluded from every check: code, diagrams, and
 * quoted source material legitimately contain dashes, arrows, quotes, and
 * exclamation marks. Kept dependency-free so tools, the lint, and unit tests
 * can import it without pulling in the eve runtime.
 */

/** Em dashes allowed per text before "sparingly" reads as overuse. */
export const MAX_EM_DASHES = 2;

/** Exclamation points allowed per text before "few" reads as overuse. */
export const MAX_EXCLAMATIONS = 2;

/** Opening/closing curly quotes and apostrophes; straight quotes are required. */
const CURLY_QUOTES = /[’‘“”]/;

/**
 * Generic heading labels the house style bans: a heading should carry the
 * argument's content, not a structural placeholder.
 */
const GENERIC_HEADINGS =
  /^(#{1,6})\s+(introduction|conclusion|overview|background|summary|other|misc|miscellaneous|section \d+)\s*$/i;

/**
 * Hype/evaluation vocabulary the precision-over-intensity rule bans wherever
 * specificity can do the work (house-style.md). Word-boundary matched.
 */
const HYPE_WORDS = [
  "cutting-edge",
  "delve",
  "facilitate",
  "game-changer",
  "game-changing",
  "leverage",
  "next-generation",
  "revolutionary",
  "robust",
  "seamless",
  "supercharge",
  "synergy",
  "unlock",
  "utilize",
];

const HYPE_PATTERN = new RegExp(
  `\\b(?:${HYPE_WORDS.join("|")})\\b`,
  "i",
);

/** Lines inside fenced code blocks are excluded from every check. */
function scanOutsideFences(
  text: string,
  visit: (line: string) => void,
): void {
  let inFence = false;

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (!inFence) {
      visit(line);
    }
  }
}

/** Consecutive markdown list-item lines, kept as groups. */
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+\S/;

/**
 * Find markdown lists with exactly one item.
 *
 * @remarks
 * A list needs at least two real items; one item is a sentence pretending to
 * be structure (house rule). Numbered and bulleted lists both count.
 *
 * @param text - Draft text to scan.
 * @returns The number of single-item lists found.
 */
export function singleItemListCount(text: string): number {
  let count = 0;
  let runLength = 0;

  scanOutsideFences(text, (line) => {
    if (LIST_ITEM.test(line)) {
      runLength += 1;
      return;
    }

    if (runLength === 1) {
      count += 1;
    }

    runLength = 0;
  });

  if (runLength === 1) {
    count += 1;
  }

  return count;
}

/**
 * Run every deterministic house rule against a draft.
 *
 * @param text - Draft text to scan.
 * @returns One human-readable violation per rule breached, each naming the
 * rule and the fix. Empty when the draft is clean.
 */
export function houseLint(text: string): string[] {
  const violations: string[] = [];

  let emDashes = 0;
  let curlyQuotes = false;
  let exclamations = 0;
  let hypeMatch: string | undefined;

  scanOutsideFences(text, (line) => {
    emDashes += (line.match(/—/g) ?? []).length;
    curlyQuotes ||= CURLY_QUOTES.test(line);
    exclamations += (line.match(/!/g) ?? []).length;
    hypeMatch ??= line.match(HYPE_PATTERN)?.[0];

    if (GENERIC_HEADINGS.test(line)) {
      violations.push(
        `Generic heading "${line.trim().replace(/^#+\s*/, "")}" — headings should carry the argument's content, not a structural label.`,
      );
    }
  });

  if (emDashes > MAX_EM_DASHES) {
    violations.push(
      `Em dashes appear ${emDashes} times — use them sparingly, for rare deliberate emphasis only (commas, colons, or parentheses carry most parenthetical work).`,
    );
  }

  if (arrowLineCount(text) > MAX_ARROW_LINES) {
    violations.push(
      "Arrow notation (→) appears on more lines than the house rule allows. In prose, express state changes as transformations (\"from X to Y\", \"X becomes Y\", or a precise transformation verb); in tables, use separate Initial state and Desired state columns. Reserve → for diagrams, equations, and one deliberately schematic passage.",
    );
  }

  if (curlyQuotes) {
    violations.push(
      'Curly quotes or apostrophes found — use straight quotes (\") and apostrophes (\') throughout.',
    );
  }

  const singleLists = singleItemListCount(text);
  if (singleLists > 0) {
    violations.push(
      `${singleLists} single-item list(s) — a list needs at least two real items; one item is a sentence, so write it as prose.`,
    );
  }

  if (exclamations > MAX_EXCLAMATIONS) {
    violations.push(
      `${exclamations} exclamation points — few is the house default; let the content carry the emphasis.`,
    );
  }

  if (hypeMatch) {
    violations.push(
      `Hype vocabulary found ("${hypeMatch}") — replace evaluation with evidence (precision over intensity).`,
    );
  }

  return violations;
}