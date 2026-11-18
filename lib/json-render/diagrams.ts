/** Shared geometry for GuitarChord and TheoryBoard diagrams. */

export const GUITAR_STRING_COUNT = 6;
export const GUITAR_FRET_COUNT = 4;

export type ChordDot = {
  readonly stringIndex: number;
  readonly fret: number;
  readonly muted: boolean;
  readonly open: boolean;
};

/**
 * Normalize frets to low-E → high-e dots for a 4-fret window.
 * Values: -1 muted, 0 open, 1+ absolute fret number.
 */
export function guitarChordDots(
  frets: readonly number[],
  baseFret: number | null | undefined,
): {
  readonly dots: readonly ChordDot[];
  readonly baseFret: number;
} {
  const values = frets.slice(0, GUITAR_STRING_COUNT);
  while (values.length < GUITAR_STRING_COUNT) values.push(-1);

  const positive = values.filter((f) => f > 0);
  const inferredBase =
    baseFret != null && Number.isFinite(baseFret) && baseFret >= 1
      ? Math.floor(baseFret)
      : positive.length > 0
        ? Math.max(1, Math.min(...positive))
        : 1;

  const dots: ChordDot[] = values.map((fret, stringIndex) => {
    if (fret < 0) {
      return { stringIndex, fret: -1, muted: true, open: false };
    }
    if (fret === 0) {
      return { stringIndex, fret: 0, muted: false, open: true };
    }
    return {
      stringIndex,
      fret: fret - inferredBase + 1,
      muted: false,
      open: false,
    };
  });

  return { dots, baseFret: inferredBase };
}

/** Circle of fifths order clockwise from top (C). */
export const CIRCLE_OF_FIFTHS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F♯",
  "D♭",
  "A♭",
  "E♭",
  "B♭",
  "F",
] as const;

export type CircleKeyPosition = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly highlighted: boolean;
};

function normalizeKeyLabel(key: string): string {
  return key
    .trim()
    .replace(/#/g, "♯")
    .replace(/b/g, "♭")
    .replace(/^Db$/i, "D♭")
    .replace(/^Ab$/i, "A♭")
    .replace(/^Eb$/i, "E♭")
    .replace(/^Bb$/i, "B♭")
    .replace(/^Gb$/i, "G♭")
    .replace(/^F#$/i, "F♯")
    .replace(/^C#$/i, "C♯");
}

/** Positions for keys on a unit circle centered at (cx, cy). */
export function circleOfFifthsPositions(
  highlightKey: string | null | undefined,
  cx = 80,
  cy = 80,
  radius = 58,
): readonly CircleKeyPosition[] {
  const highlight = highlightKey ? normalizeKeyLabel(highlightKey) : null;
  return CIRCLE_OF_FIFTHS.map((key, index) => {
    const angle = (index / CIRCLE_OF_FIFTHS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      key,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      highlighted:
        highlight != null &&
        (key === highlight ||
          key.replace("♯", "#").replace("♭", "b").toLowerCase() ===
            highlight.replace("♯", "#").replace("♭", "b").toLowerCase()),
    };
  });
}

/** Clamp pin coordinates into the schematic map frame. */
export function clampPin(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

/** Scale region bar widths so the max maps to 100%. */
export function regionBarWidths(
  values: readonly number[],
): readonly number[] {
  const safe = values.map((v) =>
    Number.isFinite(v) ? Math.max(0, v) : 0,
  );
  const max = Math.max(...safe, 0);
  if (max <= 0) return safe.map(() => 0);
  return safe.map((v) => (v / max) * 100);
}
