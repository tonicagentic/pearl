import { defineEval } from "eve/evals";

// Prod genre: song/band meaning → compare refs → writing notes → synthesis.
// Public indie names only; no private band dumps from prod.
export default defineEval({
  description:
    "4–5 turn music meaning: public artist themes → compare refs → " +
    "writing notes → synthesis. No fake discographies.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();

    const meaning = await session.send(
      "What are The National's songs usually about — themes and mood, not a " +
        "full discography dump.",
    );
    meaning.expectOk();
    meaning.notCalledTool("exa_agent_run");
    t.judge(
        "The reply discusses The National's typical themes/mood in craft " +
          "terms without inventing a fake track-by-track discography as " +
          "settled fact. Educational, not a bio dump.",
        { on: meaning.reply },
      )
      .label("song-meaning-themes")
      .atLeast(0.75);

    const compare = await session.send(
      "How does that sit next to Bon Iver and Phoebe Bridgers — overlap and " +
        "differences for someone writing in that lane?",
    );
    compare.expectOk();
    compare.notCalledTool("exa_agent_run");
    t.judge(
        "The reply compares The National-adjacent themes/mood to Bon Iver " +
          "and Phoebe Bridgers with real, non-fabricated contrasts useful " +
          "for writing. Continues the thread; no fake album catalogs.",
        { on: compare.reply },
      )
      .label("song-meaning-compare")
      .atLeast(0.75);

    const notes = await session.send(
      "Short notes I can use when writing — constraints and moves, not a " +
        "finished lyric.",
    );
    notes.expectOk();
    notes.notCalledTool("exa_agent_run");
    notes.notCalledTool("write_file");
    t.judge(
        "The reply turns the thread into practical writing notes/constraints " +
          "in-thread, using the theme/compare vocabulary already established. " +
          "Not a long file dump or a finished song.",
        { on: notes.reply },
      )
      .label("song-meaning-notes")
      .atLeast(0.75);

    const synth = await session.send(
      "One paragraph synthesis: what am I centering songs around if I follow those notes?",
    );
    synth.expectOk();
    synth.notCalledTool("exa_agent_run");
    t.judge(
        "The reply synthesizes the session into one coherent thematic aim " +
          "without inventing a new unrelated aesthetic or a fake catalog.",
        { on: synth.reply },
      )
      .label("song-meaning-synth")
      .atLeast(0.75);
  },
});
