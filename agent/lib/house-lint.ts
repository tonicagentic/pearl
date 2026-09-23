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

/**
 * Smell-test vocabulary (public-editorial-voice, The smell test): words that
 * frequently substitute for saying exactly what happened. Flagged on density,
 * never banned — a single occurrence is usually legitimate.
 */
const SMELL_WORDS = [
  // vague
  "things",
  "aspects",
  "various",
  "numerous",
  "significant",
  "meaningful",
  "important",
  "key",
  // corporate
  "empower",
  "solution",
  "stakeholder",
  "optimize",
  "holistic",
  "scalable",
  "best-in-class",
  "strategic",
  // ai-ish
  "nuanced",
  "multifaceted",
  "landscape",
  "realm",
  "tapestry",
  "pivotal",
  "underscore",
  "foster",
  "navigate",
  "interplay",
  "testament",
  "ever-evolving",
  "crucial",
  "comprehensive",
  "powerful",
  // fake signposting
  "importantly",
  "notably",
  "interestingly",
  "crucially",
  "fundamentally",
  // hedging
  "perhaps",
  "maybe",
  "arguably",
  "somewhat",
  "relatively",
  "generally",
];

/** Smell words allowed in one paragraph before the cluster flags. */
const MAX_SMELL_WORDS_PER_BLOCK = 3;

/** "Not just X" inflation constructions, flagged per occurrence. */
const CHEAP_CONTRAST =
  /\b(?:is|are|was|were|am)n't\s+(?:just|merely)\b|\bnot\s+(?:just|merely)\b/i;

/** Fake-revelation openers: if it is interesting, the next sentence should show it. */
const FAKE_REVELATION =
  /here'?s (?:the surprising part|where things get (?:interesting|powerful))|the answer (?:might )?surprise/i;

/** Reader coercion: sentence-starting pressure toward agreement. */
const READER_COERCION =
  /^\s*(?:clearly|obviously|of course,|it goes without saying)\b/i;

/** Claim laundering: consensus attributions that name no source. */
const CLAIM_LAUNDERING =
  /\b(?:research shows|studies suggest|experts agree|it'?s well understood|everyone knows)\b/i;

const SMELL_PATTERN = new RegExp(
  `\\b(?:${SMELL_WORDS.join("|")})\\b`,
  "gi",
);

/** Consecutive markdown list-item lines, kept as groups. */
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+\S/;

/** Generic table header cells the Formatting rule bans: name what the column represents. */
const GENERIC_TABLE_CELL = /^(details|notes|information|misc)$/i;

/** First sentence after a heading must advance the argument, not navigate. */
const TRANSITION_OPENER =
  /^(?:now that|having (?:discussed|covered|established)|let'?s (?:now )?turn|in this section|as we'?ve (?:seen|discussed))\b/i;

/** Heading first word, for forced-parallelism detection. */
const HEADING_FIRST_WORD = /^#{2,3}\s+(\w[\w'-]*)/;

/** Bold spans in one paragraph block; beyond this the hierarchy is decoration. */
const MAX_BOLD_PER_BLOCK = 3;

/**
 * Paragraphs beyond this many words get flagged for inspection (docs:
 * public-editorial-voice, Paragraphs). Advisory: the question is whether the
 * second half performs a different intellectual job, not word count itself.
 */
export const MAX_PARAGRAPH_WORDS = 180;

/**
 * More than this many one-sentence paragraphs in one text dilutes the "pay
 * attention" signal (public-editorial-voice: one-sentence paragraphs are
 * expensive).
 */
export const MAX_ONE_SENTENCE_PARAGRAPHS = 2;

/**
 * Sentences beyond this many words get flagged for inspection — not a
 * "sentences should be short" rule; a long sentence is legitimate when its
 * clauses develop one relationship.
 */
export const MAX_SENTENCE_WORDS = 45;

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
 * Find generic table header cells ("Details", "Notes", "Information").
 *
 * @remarks
 * The Formatting rule: column names should say what the column represents, not
 * use a structural placeholder. Applies to markdown table header rows outside
 * fenced code blocks.
 *
 * @param text - Draft text to scan.
 * @returns The offending header labels, lowercased and deduplicated.
 */
export function genericTableHeaders(text: string): string[] {
  const found = new Set<string>();

  scanOutsideFences(text, (line) => {
    if (!line.includes("|")) {
      return;
    }

    for (const cell of line.split("|")) {
      const label = cell.trim().replace(/^[`*_]/, "").replace(/[`*_]$/, "");
      if (GENERIC_TABLE_CELL.test(label)) {
        found.add(label.toLowerCase());
      }
    }
  });

  return [...found];
}

/**
 * Split draft text into prose blocks (paragraphs) outside fenced code blocks.
 *
 * @remarks
 * Blocks are separated by blank lines; heading and list-item lines are
 * excluded so sentence splitting works on wrapped prose. Each block reports
 * its word count, sentence count, and longest sentence in words — the raw
 * numbers behind the advisory length checks.
 *
 * @param text - Draft text to scan.
 * @returns One entry per prose block, in order.
 */
export function paragraphBlocks(
  text: string,
): {
  text: string;
  words: number;
  sentenceCount: number;
  longestSentenceWords: number;
}[] {
  const blocks: {
    text: string;
    words: number;
    sentenceCount: number;
    longestSentenceWords: number;
  }[] = [];

  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const prose = current
      .filter((line) => !/^\s*#{1,6}\s/.test(line))
      .join(" ")
      .trim();

    current = [];

    if (!prose) {
      return;
    }

    const sentences = prose.split(/(?<=[.!?])\s+/).filter(Boolean);
    const words = prose.split(/\s+/).filter(Boolean).length;
    blocks.push({
      text: prose,
      words,
      sentenceCount: sentences.length,
      longestSentenceWords: Math.max(
        0,
        ...sentences.map((sentence) =>
          sentence.split(/\s+/).filter(Boolean).length,
        ),
      ),
    });
  };

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      flush();
      continue;
    }

    if (inFence) {
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();

  return blocks;
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

  const tableHeaders = genericTableHeaders(text);
  if (tableHeaders.length > 0) {
    violations.push(
      `Generic table header (${[...new Set(tableHeaders)].join(", ")}) — name what the column represents ("Requirement", "Initial state"), not a placeholder.`,
    );
  }

  const firstWords = new Map<string, number>();
  scanOutsideFences(text, (line) => {
    const match = HEADING_FIRST_WORD.exec(line);
    if (match) {
      const word = match[1].toLowerCase();
      firstWords.set(word, (firstWords.get(word) ?? 0) + 1);
    }
  });
  const forced = [...firstWords.entries()].filter(([, n]) => n >= 3);
  if (forced.length > 0) {
    violations.push(
      `Forced heading parallelism: "${forced.map(([w]) => w).join('", "')}" starts ${forced.map(([, n]) => n).join("/")} headings — headings need conceptual, not grammatical, parallelism; name each section's intellectual move.`,
    );
  }

  let afterHeading = false;
  let boldInBlock = 0;
  scanOutsideFences(text, (line) => {
    if (/^#{1,6}\s/.test(line)) {
      afterHeading = true;
      return;
    }

    if (line.trim() === "") {
      boldInBlock = 0;
      return;
    }

    boldInBlock += (line.match(/\*\*[^*]+\*\*/g) ?? []).length;
    if (boldInBlock > MAX_BOLD_PER_BLOCK) {
      violations.push(
        "Bold overuse — if a paragraph needs this many bold phrases to communicate hierarchy, rewrite the paragraph.",
      );
      boldInBlock = -1000;
    }

    if (afterHeading && TRANSITION_OPENER.test(line.trim())) {
      violations.push(
        "Transition opener after a heading — the heading establishes location; the first sentence should advance the argument, not navigate (\"Now that we've discussed X, let's turn to Y\").",
      );
      afterHeading = false;
      return;
    }

    if (line.trim() !== "") {
      afterHeading = false;
    }
  });

  // Length checks (public-editorial-voice: Paragraphs / Sentence style /
  // Density): advisory "inspect" flags — the numeric ranges notice when
  // something might be wrong; they must not determine the prose.
  const blocks = paragraphBlocks(text);

  for (const block of blocks) {
    if (block.words > MAX_PARAGRAPH_WORDS) {
      violations.push(
        `Paragraph runs ${block.words} words — inspect it for multiple moves (explaining → qualifying, example → implication); split it only if the second half performs a different intellectual job.`,
      );
    }

    if (block.longestSentenceWords > MAX_SENTENCE_WORDS) {
      violations.push(
        "A sentence carries more than 45 words — inspect whether multiple independent claims are riding one structure; long sentences are legitimate when their clauses develop one relationship.",
      );
    }
  }

  const oneSentenceParagraphs = blocks.filter(
    (block) => block.sentenceCount === 1,
  ).length;

  if (oneSentenceParagraphs > MAX_ONE_SENTENCE_PARAGRAPHS) {
    violations.push(
      `${oneSentenceParagraphs} one-sentence paragraphs — use them sparingly, where a genuine turn in the argument warrants the visual weight.`,
    );
  }

  // The smell test (public-editorial-voice): flag, never ban — the question is
  // whether each word is doing intellectual work.
  for (const block of blocks) {
    const smellHits = (block.text.match(SMELL_PATTERN) ?? []).length;

    if (smellHits >= MAX_SMELL_WORDS_PER_BLOCK) {
      violations.push(
        `Smell-test cluster: ${smellHits} suspect words in one paragraph (hype, vagueness, AI-ish vocabulary, fake signposting, or hedging) — inspect whether each is doing intellectual work.`,
      );
    }

    if (CHEAP_CONTRAST.test(block.text)) {
      violations.push(
        "Cheap contrast (\"not just\" / \"isn't merely\") — keep contrast when it corrects a real confusion; otherwise state the actual relationship.",
      );
    }

    if (FAKE_REVELATION.test(block.text)) {
      violations.push(
        "Fake revelation — if it is interesting, the next sentence should demonstrate it; do not announce it.",
      );
    }

    if (CLAIM_LAUNDERING.test(block.text)) {
      violations.push(
        "Claim laundering (\"research shows\" / \"experts agree\") — name the source and conditions, or make the narrower claim you can defend.",
      );
    }
  }

  scanOutsideFences(text, (line) => {
    if (READER_COERCION.test(line)) {
      violations.push(
        "Reader coercion (\"Clearly…\" / \"Obviously…\") — delete it unless the proposition genuinely is obvious and the word serves rhythm.",
      );
    }
  });

  return violations;
}