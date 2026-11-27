import { defineEval } from "eve/evals";

// Genre arc: how a sound works → keys/chords → compare references →
// notes for writing → synthesis. Prefer search only when needed for real artists.
export default defineEval({
  description:
    "5-turn craft notes: how an indie sound works → keys/chords → " +
    "compare 2–3 references → writing notes → synthesis. No fake discographies.",
  tags: ["smoke"],
  timeoutMs: 420_000,
  async test(t) {
    const session = await t.session();

    const open = await session.send(
      "Help me understand how The National's sound works — the moody mid-tempo " +
        "rock thing with the baritone vocal. Mechanism and feel, not a bio dump.",
    );
    open.expectOk();
    open.notCalledTool("exa_agent_run");
    t.judge(
        "The reply explains The National-ish sound in craft terms (tempo, " +
          "vocal register, arrangement mood) without inventing a fake " +
          "discography or fabricated citations as the core of the answer.",
        { on: open.reply },
      )
      .label("craft-sound")
      .atLeast(0.75);

    const keys = await session.send(
      "What keys or chord habits show up a lot in that vibe — anything a " +
        "songwriter should notice?",
    );
    keys.expectOk();
    keys.notCalledTool("exa_agent_run");
    t.judge(
        "The reply continues the National / moody mid-tempo thread with " +
          "concrete harmonic or songwriting observations (keys, progressions, " +
          "habits) — not a reset to a generic music theory lecture. No fake " +
          "track-by-track discography.",
        { on: keys.reply },
      )
      .label("craft-keys")
      .atLeast(0.75);

    const compare = await session.send(
      "Compare that briefly to Bon Iver and Phoebe Bridgers — what overlaps " +
        "and what doesn't for someone writing in that lane.",
    );
    compare.expectOk();
    compare.notCalledTool("exa_agent_run");
    t.judge(
        "The reply compares The National-adjacent craft to Bon Iver and " +
          "Phoebe Bridgers with real, non-fabricated contrasts useful for " +
          "writing. Does not invent album titles or credits as settled fact " +
          "without grounding.",
        { on: compare.reply },
      )
      .label("craft-compare")
      .atLeast(0.75);

    const notes = await session.send(
      "Give me a short set of notes I can use when writing — constraints and " +
        "moves, not a finished lyric.",
    );
    notes.expectOk();
    notes.notCalledTool("exa_agent_run");
    notes.notCalledTool("write_file");
    t.judge(
        "The reply turns the thread into practical writing notes/constraints " +
          "in-thread (not a long file dump), drawing on the sound/keys/" +
          "comparison vocabulary already established.",
        { on: notes.reply },
      )
      .label("craft-notes")
      .atLeast(0.75);

    const synth = await session.send(
      "One paragraph synthesis: what am I actually aiming for if I follow those notes?",
    );
    synth.expectOk();
    synth.notCalledTool("exa_agent_run");
    t.judge(
        "The reply synthesizes the session's craft notes into one coherent " +
          "aim (mood/register/harmonic posture) without inventing a new " +
          "unrelated aesthetic or a fake catalog.",
        { on: synth.reply },
      )
      .label("craft-synth")
      .atLeast(0.75);
  },
});
