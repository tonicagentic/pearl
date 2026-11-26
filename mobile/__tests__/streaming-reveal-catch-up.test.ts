import {
  __resetStreamingRevealForTests,
  advanceStreamingReveal,
  snapStreamingReveal,
  tokenize,
} from "../../lib/streaming-text-reveal";

beforeEach(() => {
  __resetStreamingRevealForTests();
});

describe("snapStreamingReveal", () => {
  it("shows the buffered catch-up text immediately with no fade", () => {
    snapStreamingReveal();
    const tokens = tokenize("one two three four five six");
    const progress = advanceStreamingReveal(tokens, 20, 1_000);
    expect(progress.shown).toBe(6);
    expect(progress.fadeFromWord).toBe(6);
  });

  it("paces only growth after the snapped backlog", () => {
    snapStreamingReveal();
    const backlog = tokenize("one two three four five six");
    const first = advanceStreamingReveal(backlog, 20, 1_000);
    expect(first.shown).toBe(6);
    expect(first.fadeFromWord).toBe(6);

    const grown = tokenize("one two three four five six seven");
    // Tiny dt so the new word is not fully painted yet — fade floor stays at 6.
    const next = advanceStreamingReveal(grown, 20, 1_010);
    expect(next.fadeFromWord).toBe(6);
    expect(next.shown).toBeGreaterThanOrEqual(6);
    expect(next.shown).toBeLessThanOrEqual(7);
  });
});
