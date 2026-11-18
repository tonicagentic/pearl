/** Built-in open/barre chord dictionary for GuitarChord browser. */

export type ChordVoicing = {
  readonly label: string;
  /** Six frets, low E → high e. */
  readonly frets: readonly number[];
  readonly baseFret: number | null;
};

export type ChordQuality = "major" | "minor" | "7";

export type LibraryChord = {
  readonly id: string;
  readonly name: string;
  readonly quality: ChordQuality;
  readonly voicings: readonly ChordVoicing[];
};

function v(
  label: string,
  frets: readonly [number, number, number, number, number, number],
  baseFret: number | null = null,
): ChordVoicing {
  return { label, frets, baseFret };
}

/**
 * Frets are always low E → high e.
 * -1 muted, 0 open, 1+ absolute fret.
 */
export const CHORD_LIBRARY: readonly LibraryChord[] = [
  {
    id: "c-major",
    name: "C major",
    quality: "major",
    voicings: [
      v("Open", [-1, 3, 2, 0, 1, 0]),
      v("Barre 3rd", [3, 3, 5, 5, 5, 3], 3),
      v("A-shape", [-1, 3, 5, 5, 5, 3], 3),
    ],
  },
  {
    id: "c-minor",
    name: "C minor",
    quality: "minor",
    voicings: [
      v("Barre 3rd", [3, 3, 5, 5, 4, 3], 3),
      v("Open-ish", [-1, 3, 5, 5, 4, 3], 3),
    ],
  },
  {
    id: "c-7",
    name: "C7",
    quality: "7",
    voicings: [
      v("Open", [-1, 3, 2, 3, 1, 0]),
      v("Barre 3rd", [3, 3, 5, 3, 5, 3], 3),
    ],
  },
  {
    id: "d-major",
    name: "D major",
    quality: "major",
    voicings: [
      v("Open", [-1, -1, 0, 2, 3, 2]),
      v("Barre 5th", [5, 5, 7, 7, 7, 5], 5),
    ],
  },
  {
    id: "d-minor",
    name: "D minor",
    quality: "minor",
    voicings: [
      v("Open", [-1, -1, 0, 2, 3, 1]),
      v("Barre 5th", [5, 5, 7, 7, 6, 5], 5),
    ],
  },
  {
    id: "d-7",
    name: "D7",
    quality: "7",
    voicings: [
      v("Open", [-1, -1, 0, 2, 1, 2]),
      v("Barre 5th", [5, 5, 7, 5, 7, 5], 5),
    ],
  },
  {
    id: "e-major",
    name: "E major",
    quality: "major",
    voicings: [
      v("Open", [0, 2, 2, 1, 0, 0]),
      v("Barre 7th", [7, 9, 9, 8, 7, 7], 7),
    ],
  },
  {
    id: "e-minor",
    name: "E minor",
    quality: "minor",
    voicings: [
      v("Open", [0, 2, 2, 0, 0, 0]),
      v("Barre 7th", [7, 9, 9, 7, 7, 7], 7),
    ],
  },
  {
    id: "e-7",
    name: "E7",
    quality: "7",
    voicings: [
      v("Open", [0, 2, 0, 1, 0, 0]),
      v("Open alt", [0, 2, 2, 1, 3, 0]),
    ],
  },
  {
    id: "f-major",
    name: "F major",
    quality: "major",
    voicings: [
      v("Barre 1st", [1, 3, 3, 2, 1, 1], 1),
      v("Mini", [-1, -1, 3, 2, 1, 1]),
    ],
  },
  {
    id: "f-minor",
    name: "F minor",
    quality: "minor",
    voicings: [
      v("Barre 1st", [1, 3, 3, 1, 1, 1], 1),
      v("Mini", [-1, -1, 3, 1, 1, 1]),
    ],
  },
  {
    id: "f-7",
    name: "F7",
    quality: "7",
    voicings: [v("Barre 1st", [1, 3, 1, 2, 1, 1], 1)],
  },
  {
    id: "g-major",
    name: "G major",
    quality: "major",
    voicings: [
      v("Open", [3, 2, 0, 0, 0, 3]),
      v("Open alt", [3, 2, 0, 0, 3, 3]),
      v("Barre 3rd", [3, 5, 5, 4, 3, 3], 3),
      v("C-shape", [-1, -1, 0, 0, 0, 3]),
    ],
  },
  {
    id: "g-minor",
    name: "G minor",
    quality: "minor",
    voicings: [
      v("Barre 3rd", [3, 5, 5, 3, 3, 3], 3),
      v("Open-ish", [-1, -1, 0, 3, 3, 3]),
    ],
  },
  {
    id: "g-7",
    name: "G7",
    quality: "7",
    voicings: [
      v("Open", [3, 2, 0, 0, 0, 1]),
      v("Barre 3rd", [3, 5, 3, 4, 3, 3], 3),
    ],
  },
  {
    id: "a-major",
    name: "A major",
    quality: "major",
    voicings: [
      v("Open", [-1, 0, 2, 2, 2, 0]),
      v("Barre 5th", [5, 7, 7, 6, 5, 5], 5),
    ],
  },
  {
    id: "a-minor",
    name: "A minor",
    quality: "minor",
    voicings: [
      v("Open", [-1, 0, 2, 2, 1, 0]),
      v("Barre 5th", [5, 7, 7, 5, 5, 5], 5),
    ],
  },
  {
    id: "a-7",
    name: "A7",
    quality: "7",
    voicings: [
      v("Open", [-1, 0, 2, 0, 2, 0]),
      v("Open alt", [-1, 0, 2, 2, 2, 3]),
    ],
  },
  {
    id: "b-major",
    name: "B major",
    quality: "major",
    voicings: [
      v("Barre 2nd", [-1, 2, 4, 4, 4, 2], 2),
      v("Barre 7th", [7, 9, 9, 8, 7, 7], 7),
    ],
  },
  {
    id: "b-minor",
    name: "B minor",
    quality: "minor",
    voicings: [
      v("Barre 2nd", [-1, 2, 4, 4, 3, 2], 2),
      v("Barre 7th", [7, 9, 9, 7, 7, 7], 7),
    ],
  },
  {
    id: "b-7",
    name: "B7",
    quality: "7",
    voicings: [
      v("Open", [-1, 2, 1, 2, 0, 2]),
      v("Barre 2nd", [-1, 2, 4, 2, 4, 2], 2),
    ],
  },
  {
    id: "fsharp-major",
    name: "F♯ major",
    quality: "major",
    voicings: [
      v("Barre 2nd", [2, 4, 4, 3, 2, 2], 2),
      v("Barre 9th", [9, 11, 11, 10, 9, 9], 9),
    ],
  },
  {
    id: "fsharp-minor",
    name: "F♯ minor",
    quality: "minor",
    voicings: [v("Barre 2nd", [2, 4, 4, 2, 2, 2], 2)],
  },
  {
    id: "bb-major",
    name: "B♭ major",
    quality: "major",
    voicings: [
      v("Barre 1st", [-1, 1, 3, 3, 3, 1], 1),
      v("Barre 6th", [6, 8, 8, 7, 6, 6], 6),
    ],
  },
  {
    id: "bb-minor",
    name: "B♭ minor",
    quality: "minor",
    voicings: [v("Barre 1st", [-1, 1, 3, 3, 2, 1], 1)],
  },
];

function normalizeChordName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+/g, " ")
    .replace(/^([a-g])\s*#/, "$1#")
    .replace(/^([a-g])\s*b(?![a-z])/, "$1b")
    .replace(/\bmaj(or)?\b/g, "major")
    .replace(/\bmin(or)?\b/g, "minor")
    .replace(/\bdom(inant)?\s*7\b/g, "7")
    .replace(/\bmajor\s*7\b/g, "maj7")
    .replace(/\s*7$/, "7");
}

const ALIASES: Record<string, string> = {
  c: "c major",
  "c maj": "c major",
  cm: "c minor",
  "c m": "c minor",
  d: "d major",
  dm: "d minor",
  e: "e major",
  em: "e minor",
  f: "f major",
  fm: "f minor",
  g: "g major",
  gm: "g minor",
  a: "a major",
  am: "a minor",
  b: "b major",
  bm: "b minor",
  "f#": "f# major",
  "f#m": "f# minor",
  "gb major": "f# major",
  bb: "bb major",
  "a# major": "bb major",
  "g7": "g7",
  "c7": "c7",
  "d7": "d7",
  "e7": "e7",
  "a7": "a7",
  "b7": "b7",
  "f7": "f7",
};

export function listLibraryChords(): readonly LibraryChord[] {
  return CHORD_LIBRARY;
}

export function findChordByName(name: string): LibraryChord | null {
  const normalized = normalizeChordName(name);
  const aliased = ALIASES[normalized] ?? normalized;
  const match = CHORD_LIBRARY.find((chord) => {
    const chordKey = normalizeChordName(chord.name);
    return (
      chordKey === aliased ||
      chordKey === normalized ||
      chord.id === normalized.replace(/\s+/g, "-")
    );
  });
  return match ?? null;
}

export function fretsEqual(
  a: readonly number[],
  b: readonly number[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Merge agent-provided voicings with library voicings for a chord.
 * Agent shapes that match a library fretting keep the library label when possible;
 * novel agent shapes are prepended.
 */
export function mergeVoicings(
  library: LibraryChord | null,
  agent: {
    name: string;
    frets: readonly number[];
    baseFret: number | null;
    voicings?: readonly ChordVoicing[] | null;
  },
): readonly ChordVoicing[] {
  const agentList: ChordVoicing[] = [
    {
      label: "Default",
      frets: agent.frets as ChordVoicing["frets"],
      baseFret: agent.baseFret,
    },
    ...(agent.voicings ?? []),
  ];

  if (!library) {
    return agentList.map((voicing, index) =>
      index === 0 && agentList.length === 1
        ? { ...voicing, label: "Open" }
        : voicing,
    );
  }

  const merged: ChordVoicing[] = [];
  const seen = new Set<string>();

  const keyOf = (voicing: ChordVoicing) =>
    `${voicing.baseFret ?? "n"}:${voicing.frets.join(",")}`;

  for (const voicing of agentList) {
    const libraryMatch = library.voicings.find((candidate) =>
      fretsEqual(candidate.frets, voicing.frets),
    );
    const next = libraryMatch
      ? libraryMatch
      : {
          ...voicing,
          label:
            voicing.label === "Default"
              ? library.voicings[0]?.label ?? "Default"
              : voicing.label,
        };
    const key = keyOf(next);
    if (seen.has(key)) continue;
    // Also skip when frets already present under a different base label.
    if (
      merged.some((existing) => fretsEqual(existing.frets, next.frets))
    ) {
      continue;
    }
    seen.add(key);
    merged.push(next);
  }

  for (const voicing of library.voicings) {
    const key = keyOf(voicing);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(voicing);
  }

  return merged;
}

/** Resolve starting library index from an agent chord name. */
export function initialLibraryIndex(name: string): number {
  const found = findChordByName(name);
  if (!found) return 0;
  const index = CHORD_LIBRARY.findIndex((chord) => chord.id === found.id);
  return index >= 0 ? index : 0;
}
