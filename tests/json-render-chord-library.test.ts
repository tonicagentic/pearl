import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  findChordByName,
  initialLibraryIndex,
  listLibraryChords,
  mergeVoicings,
} from "../lib/json-render/chord-library.ts";
import { guitarChordDots } from "../lib/json-render/diagrams.ts";

describe("chord library", () => {
  it("lists common major/minor/7th chords", () => {
    const chords = listLibraryChords();
    assert.ok(chords.length >= 20);
    assert.ok(chords.some((chord) => chord.id === "g-major"));
    assert.ok(chords.some((chord) => chord.quality === "7"));
  });

  it("finds G major by name aliases", () => {
    const chord = findChordByName("G major");
    assert.ok(chord);
    assert.equal(chord.id, "g-major");
    assert.ok(chord.voicings.length >= 2);
    assert.deepEqual([...chord.voicings[0]!.frets], [3, 2, 0, 0, 0, 3]);
  });

  it("resolves initial library index for G major", () => {
    const index = initialLibraryIndex("G major");
    assert.equal(listLibraryChords()[index]?.id, "g-major");
  });

  it("merges agent voicings with library shapes", () => {
    const library = findChordByName("G major");
    assert.ok(library);
    const merged = mergeVoicings(library, {
      name: "G major",
      frets: [3, 2, 0, 0, 0, 3],
      baseFret: 1,
      voicings: [
        {
          label: "Custom",
          frets: [3, 2, 0, 0, 3, 3],
          baseFret: 1,
        },
      ],
    });
    assert.ok(merged.length >= 3);
    assert.equal(merged[0]?.label, "Open");
    assert.ok(merged.some((voicing) => voicing.label === "Open alt" || voicing.label === "Custom"));
  });
});

describe("guitarChordDots open-position base", () => {
  it("keeps the nut for open G instead of sliding to fret 2", () => {
    const result = guitarChordDots([3, 2, 0, 0, 0, 3], null);
    assert.equal(result.baseFret, 1);
    const fretted = result.dots.filter((dot) => !dot.open && !dot.muted);
    assert.deepEqual(
      fretted.map((dot) => dot.fret).sort((a, b) => a - b),
      [2, 3, 3],
    );
  });

  it("respects an explicit barre base fret", () => {
    const result = guitarChordDots([3, 5, 5, 4, 3, 3], 3);
    assert.equal(result.baseFret, 3);
  });
});
