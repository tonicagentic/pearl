import { defineEval } from "eve/evals";

const LYRIC = `midnight parking lot, engine still warm
you said nothing sharp but it cut the same
I keep the receipt of every almost
folded in the pocket of your name`;

export default defineEval({
  description:
    "Pasted short lyric → preserve voice, concrete craft notes; no unsolicited full rewrite.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const turn = await t.send(
      "I'm trying to write lyrics. What do you think of this verse?\n\n" +
        LYRIC +
        "\n\nCraft notes only — don't rewrite the whole thing unless I ask.",
    );

    t.succeeded();
    turn.notCalledTool("write_file");
    turn.notCalledTool("exa_agent_run");

    t.judge(
        "The feedback engages this specific lyric (parking lot / almost / " +
          "receipt / name imagery) with concrete craft notes. It preserves " +
          "the author's voice rather than replacing the verse unprompted. " +
          "A full rewrite of the whole verse as the main reply fails. " +
          "Generic cheerleading without craft fails.",
        { on: turn.reply },
      )
      .label("lyric-craft-notes")
      .atLeast(0.8);
  },
});
